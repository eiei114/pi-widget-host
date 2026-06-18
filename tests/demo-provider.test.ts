import assert from "node:assert/strict";
import test from "node:test";
import { createDefaultConfig } from "../lib/config.ts";
import { buildDemoProviderEntry, stopDemoProviderHeartbeat, syncBuiltInDemoProvider } from "../lib/demo-provider.ts";
import { evaluateProviderEntries } from "../lib/policy.ts";
import { getWidgetHostRegistry, markHostPresent, clearHostPresent } from "../lib/registry.ts";
import { DEMO_PROVIDER_ID } from "../lib/types.ts";

test("demo provider stays silent until setup enables it", async () => {
  const registry = getWidgetHostRegistry();
  registry.clear();
  stopDemoProviderHeartbeat();
  clearHostPresent();

  const defaultConfig = createDefaultConfig();
  assert.equal(defaultConfig.setupComplete, false);
  assert.equal(defaultConfig.demoProviderEnabled, false);

  await syncBuiltInDemoProvider(defaultConfig);
  assert.deepEqual(registry.list(), []);

  const silent = evaluateProviderEntries(registry.list(), defaultConfig);
  assert.equal(silent.activeProvider, undefined);
});

test("enabled demo provider publishes render lines through the registry", async () => {
  const registry = getWidgetHostRegistry();
  registry.clear();
  stopDemoProviderHeartbeat();
  markHostPresent();

  const config = {
    ...createDefaultConfig(),
    setupComplete: true,
    demoProviderEnabled: true,
  };

  try {
    await syncBuiltInDemoProvider(config);

    const entries = registry.list();
    assert.equal(entries.length, 1);
    assert.equal(entries[0]?.providerId, DEMO_PROVIDER_ID);
    assert.ok((entries[0]?.lines.length ?? 0) > 0);

    const result = evaluateProviderEntries(entries, config);
    assert.equal(result.activeProvider?.providerId, DEMO_PROVIDER_ID);
    assert.ok((result.activeProvider?.lines.length ?? 0) > 0);
  } finally {
    stopDemoProviderHeartbeat();
    registry.clear();
    clearHostPresent();
  }
});

test("buildDemoProviderEntry includes preset and time-block context", () => {
  const config = {
    ...createDefaultConfig(),
    presetId: "focus-day",
    demoProviderEnabled: true,
  };
  const morning = new Date(2026, 5, 15, 7, 0, 0, 0);
  const entry = buildDemoProviderEntry(config, morning);

  assert.equal(entry.providerId, DEMO_PROVIDER_ID);
  assert.equal(entry.available, true);
  assert.match(entry.lines.join("\n"), /focus-day/);
  assert.match(entry.lines.join("\n"), /morning/);
});
