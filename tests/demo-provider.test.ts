import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createDefaultConfig } from "../lib/config.ts";
import { buildDemoProviderEntry, stopDemoProviderHeartbeat, syncBuiltInDemoProvider } from "../lib/demo-provider.ts";
import { DEFAULT_PRESET_ID, evaluateProviderEntries, getBlockPreferredTags, getPreset, getRemainingTtlMs } from "../lib/policy.ts";
import { clearHostPresent, getWidgetHostRegistry, markHostPresent } from "../lib/registry.ts";
import { DEMO_PROVIDER_ID } from "../lib/types.ts";
import { ensureRegistryWatcher, refreshHostWidget, resetHostExtensionStateForTests } from "../extensions/index.ts";

/**
 * Runs `run` with `Date` replaced by a clock that advances 1 ms per read.
 *
 * The host registry dedupes on exact entry JSON including `updatedAt`, so two
 * rebuilds that land inside the same millisecond are silently absorbed. A real
 * host reads its clock across milliseconds, so the distinct clock is the honest
 * model of the loop under test, not an artificial stressor.
 */
async function withDistinctClock<T>(run: () => Promise<T>): Promise<T> {
  const RealDate = Date;
  let tick = RealDate.UTC(2026, 5, 15, 12, 0, 0, 0);

  class DistinctDate extends RealDate {
    constructor(...args: unknown[]) {
      if (args.length === 0) {
        super(tick);
        tick += 1;
        return;
      }
      super(...(args as [number]));
    }

    static now(): number {
      const value = tick;
      tick += 1;
      return value;
    }
  }

  globalThis.Date = DistinctDate as unknown as DateConstructor;
  try {
    return await run();
  } finally {
    globalThis.Date = RealDate;
  }
}

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

test("demo provider block tags reuse always-demo preset preferred tags", () => {
  const config = {
    ...createDefaultConfig(),
    demoProviderEnabled: true,
  };
  const preset = getPreset(DEFAULT_PRESET_ID);
  const blocks = [
    { block: "morning" as const, at: new Date(2026, 5, 15, 7, 0, 0, 0) },
    { block: "day" as const, at: new Date(2026, 5, 15, 13, 0, 0, 0) },
    { block: "evening" as const, at: new Date(2026, 5, 15, 19, 0, 0, 0) },
    { block: "night" as const, at: new Date(2026, 5, 15, 23, 0, 0, 0) },
  ];

  for (const { block, at } of blocks) {
    const entry = buildDemoProviderEntry(config, at);
    const expected = getBlockPreferredTags(preset, block);
    assert.deepEqual([...(entry.tags ?? [])].sort(), [...expected].sort(), `${block} tags should match always-demo preset`);
  }
});

test("demo provider tags ignore saved preset and stay on always-demo block tags", () => {
  const config = {
    ...createDefaultConfig(),
    presetId: "focus-day",
    demoProviderEnabled: true,
  };
  const morning = new Date(2026, 5, 15, 7, 0, 0, 0);
  const entry = buildDemoProviderEntry(config, morning);
  const alwaysDemoTags = getBlockPreferredTags(getPreset(DEFAULT_PRESET_ID), "morning");

  assert.deepEqual([...(entry.tags ?? [])].sort(), [...alwaysDemoTags].sort());
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

test("resyncing unchanged demo content does not republish to the registry", async () => {
  const registry = getWidgetHostRegistry();
  const config = {
    ...createDefaultConfig(),
    setupComplete: true,
    demoProviderEnabled: true,
  };

  registry.clear();
  clearHostPresent();
  markHostPresent();
  stopDemoProviderHeartbeat();

  let notifications = 0;
  const dispose = registry.subscribe(() => {
    notifications += 1;
  });

  try {
    await withDistinctClock(async () => {
      await syncBuiltInDemoProvider(config);
      const afterFirstSync = notifications;
      assert.equal(afterFirstSync, 1, "first sync should publish the demo entry once");

      // The host's registry watcher re-enters refreshHostWidget on every
      // publication, which syncs the demo provider again. Unchanged content must
      // not publish a second time, or the host reads its own echo forever.
      for (let repeat = 0; repeat < 5; repeat += 1) {
        await syncBuiltInDemoProvider(config);
      }

      assert.equal(notifications, afterFirstSync, "unchanged demo content must not notify subscribers again");
    });
  } finally {
    dispose();
    stopDemoProviderHeartbeat();
    clearHostPresent();
    registry.clear();
  }
});

test("demo content changes still republish", async () => {
  const registry = getWidgetHostRegistry();
  const config = {
    ...createDefaultConfig(),
    setupComplete: true,
    demoProviderEnabled: true,
  };

  registry.clear();
  clearHostPresent();
  markHostPresent();
  stopDemoProviderHeartbeat();

  let notifications = 0;
  const dispose = registry.subscribe(() => {
    notifications += 1;
  });

  const previousTags = process.env.PI_WIDGET_HOST_DEMO_MATCHDAY;
  try {
    process.env.PI_WIDGET_HOST_DEMO_MATCHDAY = "1";
    await syncBuiltInDemoProvider(config);
    assert.equal(notifications, 1);
    assert.ok(
      (registry.list()[0]?.tags ?? []).includes("matchday"),
      "event tag should be published on first sync",
    );

    process.env.PI_WIDGET_HOST_DEMO_MATCHDAY = "0";
    const configWithoutMatchday = { ...config, presetId: "focus-day" };
    await syncBuiltInDemoProvider(configWithoutMatchday);

    assert.equal(notifications, 2, "content change must republish");
    assert.match(registry.list()[0]?.lines.join("\n") ?? "", /focus-day/);
  } finally {
    if (previousTags === undefined) delete process.env.PI_WIDGET_HOST_DEMO_MATCHDAY;
    else process.env.PI_WIDGET_HOST_DEMO_MATCHDAY = previousTags;
    dispose();
    stopDemoProviderHeartbeat();
    clearHostPresent();
    registry.clear();
  }
});

test("a stale demo entry is still revived by a refresh", async () => {
  const registry = getWidgetHostRegistry();
  const config = {
    ...createDefaultConfig(),
    setupComplete: true,
    demoProviderEnabled: true,
  };

  registry.clear();
  clearHostPresent();
  markHostPresent();
  stopDemoProviderHeartbeat();

  const RealDate = Date;
  let nowMs = RealDate.now();

  class JumpableDate extends RealDate {
    constructor(...args: unknown[]) {
      if (args.length === 0) {
        super(nowMs);
        return;
      }
      super(...(args as [number]));
    }

    static now(): number {
      return nowMs;
    }
  }

  globalThis.Date = JumpableDate as unknown as DateConstructor;
  try {
    await syncBuiltInDemoProvider(config);
    const first = registry.list()[0];
    assert.ok(first, "first sync should publish");

    // Process was suspended longer than ttlMs, so the heartbeat never fired.
    nowMs = RealDate.parse(first.updatedAt) + 120_000;
    await syncBuiltInDemoProvider(config);

    const refreshed = registry.list()[0];
    assert.ok(refreshed, "refresh should still have an entry");
    assert.notEqual(refreshed.updatedAt, first.updatedAt, "a stale entry must be refreshed");
    assert.equal(getRemainingTtlMs(refreshed, nowMs), 90_000);

    const result = evaluateProviderEntries(registry.list(), config, new Date(nowMs));
    assert.equal(result.activeProvider?.providerId, DEMO_PROVIDER_ID);
  } finally {
    globalThis.Date = RealDate;
    stopDemoProviderHeartbeat();
    clearHostPresent();
    registry.clear();
  }
});

test("host refresh watcher settles instead of echoing its own demo publications", async () => {
  const prevAgentDir = process.env.PI_WIDGET_HOST_AGENT_DIR;
  const dir = await mkdtemp(join(tmpdir(), "pi-widget-host-echo-"));

  const { writeHostConfig } = await import("../lib/config.ts");

  try {
    process.env.PI_WIDGET_HOST_AGENT_DIR = dir;
    await writeHostConfig({
      schemaVersion: 1,
      setupComplete: true,
      demoProviderEnabled: true,
      presetId: "always-demo",
      mutedProviderIds: [],
    });

    const registry = getWidgetHostRegistry();
    registry.clear();
    clearHostPresent();
    markHostPresent();
    resetHostExtensionStateForTests();

    const ui = {
      widgetWrites: 0,
      setWidget: () => {
        ui.widgetWrites += 1;
      },
      notify: () => undefined,
      setStatus: () => undefined,
      select: async () => undefined,
    };
    const ctx = { hasUI: true as const, ui };

    let publications = 0;
    const originalSet = registry.set;
    registry.set = ((entry) => {
      publications += 1;
      return originalSet.call(registry, entry);
    }) as typeof registry.set;

    try {
      await withDistinctClock(async () => {
        // Same order as session_start: watcher first, then one refresh.
        ensureRegistryWatcher();
        await refreshHostWidget(ctx);

        const settledPublications = publications;
        const settledWrites = ui.widgetWrites;

        // Any second provider publishing is a normal host event. It must not
        // trigger an unbounded demo-provider echo loop.
        registry.set({
          providerId: "external.provider",
          available: true,
          lines: ["external"],
          updatedAt: new Date().toISOString(),
        });
        await new Promise<void>((resolve) => setTimeout(resolve, 75));

        assert.ok(
          publications - settledPublications <= 2,
          `expected a settled refresh, saw ${publications - settledPublications} demo publications after one external event`,
        );
        assert.ok(
          ui.widgetWrites - settledWrites <= 3,
          `expected bounded widget writes, saw ${ui.widgetWrites - settledWrites}`,
        );
      });
    } finally {
      registry.set = originalSet;
      resetHostExtensionStateForTests();
      clearHostPresent();
      registry.clear();
    }
  } finally {
    resetHostExtensionStateForTests();
    if (prevAgentDir === undefined) delete process.env.PI_WIDGET_HOST_AGENT_DIR;
    else process.env.PI_WIDGET_HOST_AGENT_DIR = prevAgentDir;
    await rm(dir, { recursive: true, force: true });
  }
});
