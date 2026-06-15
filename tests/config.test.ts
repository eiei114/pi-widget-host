import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createDefaultConfig, readHostConfig, writeHostConfig } from "../lib/config.ts";

test("config store falls back to defaults and persists valid values", async () => {
  const dir = await mkdtemp(join(tmpdir(), "pi-widget-host-config-"));
  process.env.PI_WIDGET_HOST_AGENT_DIR = dir;

  const initial = await readHostConfig();
  assert.deepEqual(initial, createDefaultConfig());

  const saved = await writeHostConfig({
    ...initial,
    setupComplete: true,
    demoProviderEnabled: true,
    presetId: "focus-day",
    mutedProviderIds: ["alpha", "alpha", "beta"],
  });

  assert.equal(saved.setupComplete, true);
  assert.equal(saved.demoProviderEnabled, true);
  assert.equal(saved.presetId, "focus-day");
  assert.deepEqual(saved.mutedProviderIds, ["alpha", "beta"]);

  const reread = await readHostConfig();
  assert.deepEqual(reread, saved);

  delete process.env.PI_WIDGET_HOST_AGENT_DIR;
  await rm(dir, { recursive: true, force: true });
});
