import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createDefaultConfig, readHostConfig, updateHostConfig } from "../lib/config.ts";
import { evaluateProviderEntries } from "../lib/policy.ts";
import { getWidgetHostRegistry } from "../lib/registry.ts";
import { type ProviderEntry } from "../lib/types.ts";

function baseEntry(overrides: Partial<ProviderEntry> = {}): ProviderEntry {
  return {
    providerId: "provider-a",
    available: true,
    lines: ["line"],
    updatedAt: "2026-06-15T12:00:00.000Z",
    priority: 10,
    tags: ["music"],
    ttlMs: 60_000,
    ...overrides,
  };
}

test("registry subscription reruns selection when entries change", () => {
  const registry = getWidgetHostRegistry();
  registry.clear();
  const config = createDefaultConfig();
  const now = new Date("2026-06-15T12:00:00.000Z");
  const activeIds: string[] = [];

  const dispose = registry.subscribe(() => {
    const result = evaluateProviderEntries(registry.list(), config, now);
    activeIds.push(result.activeProvider?.providerId ?? "none");
  });

  registry.set(baseEntry({ providerId: "provider-a", priority: 5 }));
  registry.set(baseEntry({ providerId: "provider-b", priority: 20 }));
  registry.remove("provider-b");

  assert.deepEqual(activeIds, ["provider-a", "provider-b", "provider-a"]);

  dispose();
  registry.clear();
});

test("provider inventory reports active, muted, stale, and unavailable states", () => {
  const config = {
    ...createDefaultConfig(),
    mutedProviderIds: ["muted-provider"],
  };
  const now = new Date("2026-06-15T12:00:30.000Z");

  const result = evaluateProviderEntries(
    [
      baseEntry({ providerId: "active-provider", priority: 50 }),
      baseEntry({ providerId: "muted-provider" }),
      baseEntry({ providerId: "stale-provider", updatedAt: "2026-06-15T11:58:00.000Z", ttlMs: 1_000 }),
      baseEntry({ providerId: "unavailable-provider", available: false }),
    ],
    config,
    now,
  );

  const byId = Object.fromEntries(result.providerStates.map((state) => [state.providerId, state.effectiveStatus]));

  assert.equal(byId["active-provider"], "active");
  assert.equal(byId["muted-provider"], "muted");
  assert.equal(byId["stale-provider"], "stale");
  assert.equal(byId["unavailable-provider"], "unavailable");
});

test("mute and unmute persist in host config without removing registry entries", async () => {
  const prev = process.env.PI_WIDGET_HOST_AGENT_DIR;
  const dir = await mkdtemp(join(tmpdir(), "pi-widget-host-mute-"));

  try {
    process.env.PI_WIDGET_HOST_AGENT_DIR = dir;

    await updateHostConfig((config) => ({
      ...config,
      mutedProviderIds: [...config.mutedProviderIds, "provider-a"],
    }));

    const muted = await readHostConfig();
    assert.deepEqual(muted.mutedProviderIds, ["provider-a"]);

    await updateHostConfig((config) => ({
      ...config,
      mutedProviderIds: config.mutedProviderIds.filter((id) => id !== "provider-a"),
    }));

    const unmuted = await readHostConfig();
    assert.deepEqual(unmuted.mutedProviderIds, []);
  } finally {
    if (prev === undefined) delete process.env.PI_WIDGET_HOST_AGENT_DIR;
    else process.env.PI_WIDGET_HOST_AGENT_DIR = prev;
    await rm(dir, { recursive: true, force: true });
  }
});
