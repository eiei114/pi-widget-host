import assert from "node:assert/strict";
import test from "node:test";
import { createDefaultConfig } from "../lib/config.ts";
import { DEFAULT_PRESET_ID, evaluateProviderEntries } from "../lib/policy.ts";
import { DEMO_PROVIDER_ID, type ProviderEntry } from "../lib/types.ts";

function baseEntry(overrides: Partial<ProviderEntry> = {}): ProviderEntry {
  return {
    providerId: DEMO_PROVIDER_ID,
    available: true,
    lines: ["demo"],
    updatedAt: "2026-06-15T12:00:00.000Z",
    priority: 10,
    tags: ["music", "idle"],
    ttlMs: 60_000,
    ...overrides,
  };
}

test("preset change can switch active provider to silent empty slot", () => {
  const config = createDefaultConfig();
  const night = new Date(2026, 5, 15, 23, 30, 0, 0);
  const freshEntry = baseEntry({ updatedAt: night.toISOString() });

  const always = evaluateProviderEntries([freshEntry], { ...config, presetId: DEFAULT_PRESET_ID }, night);
  assert.equal(always.activeProvider?.providerId, DEMO_PROVIDER_ID);

  const focusDay = evaluateProviderEntries([freshEntry], { ...config, presetId: "focus-day" }, night);
  assert.equal(focusDay.activeProvider, undefined);
});

test("event boost can outrank a higher base priority competitor", () => {
  const config = createDefaultConfig();
  const morning = new Date(2026, 5, 15, 7, 30, 0, 0);
  const freshIso = morning.toISOString();

  const result = evaluateProviderEntries(
    [
      baseEntry({ providerId: "music-provider", priority: 5, tags: ["music", "playing-now"], updatedAt: freshIso }),
      baseEntry({ providerId: "sports-provider", priority: 80, tags: ["sports"], updatedAt: freshIso }),
    ],
    { ...config, presetId: DEFAULT_PRESET_ID },
    morning,
  );

  assert.equal(result.activeProvider?.providerId, "music-provider");
});

test("mute and stale entries are excluded from selection", () => {
  const config = createDefaultConfig();
  const now = new Date("2026-06-15T12:00:30.000Z");
  const result = evaluateProviderEntries(
    [
      baseEntry({ providerId: "muted-provider" }),
      baseEntry({ providerId: "stale-provider", updatedAt: "2026-06-15T11:58:00.000Z", ttlMs: 1_000 }),
    ],
    { ...config, mutedProviderIds: ["muted-provider"] },
    now,
  );

  assert.equal(result.activeProvider, undefined);
  assert.equal(result.providerStates.find((state) => state.providerId === "muted-provider")?.effectiveStatus, "muted");
  assert.equal(result.providerStates.find((state) => state.providerId === "stale-provider")?.effectiveStatus, "stale");
});

test("unknown tags are ignored safely", () => {
  const config = createDefaultConfig();
  const result = evaluateProviderEntries([baseEntry({ tags: ["music", "totally-unknown"] })], config, new Date("2026-06-15T06:00:00.000Z"));
  assert.deepEqual(result.providerStates[0]?.knownTags, ["music"]);
});
