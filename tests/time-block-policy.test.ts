import assert from "node:assert/strict";
import test from "node:test";
import { createDefaultConfig } from "../lib/config.ts";
import { detectTimeBlock, evaluateProviderEntries } from "../lib/policy.ts";
import { DEMO_PROVIDER_ID, type ProviderEntry } from "../lib/types.ts";

function freshEntry(overrides: Partial<ProviderEntry> = {}): ProviderEntry {
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

test("detectTimeBlock maps morning, day, evening, and night", () => {
  assert.equal(detectTimeBlock(new Date(2026, 5, 15, 5, 0, 0, 0)), "morning");
  assert.equal(detectTimeBlock(new Date(2026, 5, 15, 11, 0, 0, 0)), "day");
  assert.equal(detectTimeBlock(new Date(2026, 5, 15, 17, 0, 0, 0)), "evening");
  assert.equal(detectTimeBlock(new Date(2026, 5, 15, 22, 0, 0, 0)), "night");
});

test("all time blocks evaluate through the same preset policy path", () => {
  const config = { ...createDefaultConfig(), presetId: "night-owl" };
  const blocks = [
    { label: "morning", at: new Date(2026, 5, 15, 7, 0, 0, 0) },
    { label: "day", at: new Date(2026, 5, 15, 13, 0, 0, 0) },
    { label: "evening", at: new Date(2026, 5, 15, 19, 0, 0, 0) },
    { label: "night", at: new Date(2026, 5, 15, 23, 0, 0, 0) },
  ] as const;

  for (const block of blocks) {
    const entry = freshEntry({ updatedAt: block.at.toISOString() });
    const result = evaluateProviderEntries([entry], config, block.at);
    assert.equal(result.timeBlock, block.label);
    assert.equal(result.preset.id, "night-owl");

    if (block.label === "morning" || block.label === "day") {
      assert.equal(result.activeProvider, undefined, `${block.label} should stay silent for night-owl`);
    } else {
      assert.equal(result.activeProvider?.providerId, DEMO_PROVIDER_ID, `${block.label} should allow demo provider`);
    }
  }
});

test("active provider selection changes when saved preset changes", () => {
  const night = new Date(2026, 5, 15, 23, 30, 0, 0);
  const entry = freshEntry({ updatedAt: night.toISOString() });

  const alwaysDemo = evaluateProviderEntries([entry], { ...createDefaultConfig(), presetId: "always-demo" }, night);
  assert.equal(alwaysDemo.activeProvider?.providerId, DEMO_PROVIDER_ID);

  const focusDay = evaluateProviderEntries([entry], { ...createDefaultConfig(), presetId: "focus-day" }, night);
  assert.equal(focusDay.activeProvider, undefined);
});
