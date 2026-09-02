import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  ensureRegistryWatcher,
  isRegistryWatcherActiveForTests,
  refreshHostWidget,
  resetHostExtensionStateForTests,
} from "../extensions/index.ts";
import { writeHostConfig } from "../lib/config.ts";
import { getRemainingTtlMs } from "../lib/policy.ts";
import { getWidgetHostRegistry } from "../lib/registry.ts";
import { WIDGET_ID, type ProviderEntry } from "../lib/types.ts";

const FIXED_NOW_MS = Date.parse("2026-06-15T12:00:00.000Z");
const FIXED_NOW_ISO = new Date(FIXED_NOW_MS).toISOString();

function baseEntry(overrides: Partial<ProviderEntry> = {}): ProviderEntry {
  return {
    providerId: "provider-a",
    available: true,
    lines: ["refresh-test"],
    updatedAt: FIXED_NOW_ISO,
    priority: 20,
    tags: ["music"],
    ttlMs: 5_000,
    ...overrides,
  };
}

interface HostUiMock {
  setWidgetCalls: Array<[string, string[] | undefined]>;
  setWidget: (id: string, lines: string[] | undefined) => void;
  notify: (message: string, level: "info" | "warning" | "error") => void;
  setStatus: (key: string, value: string | undefined) => void;
  select: (prompt: string, options: string[]) => Promise<string | undefined>;
}

function createHostUiMock(): HostUiMock {
  const ui: HostUiMock = {
    setWidgetCalls: [],
    setWidget(id, lines) {
      ui.setWidgetCalls.push([id, lines]);
    },
    notify: () => undefined,
    setStatus: () => undefined,
    select: async () => undefined,
  };
  return ui;
}

async function waitForWidgetRefresh(
  ui: HostUiMock,
  previousCallCount: number,
  timeoutMs = 1_000,
): Promise<void> {
  const started = performance.now();
  while (ui.setWidgetCalls.length <= previousCallCount) {
    if (performance.now() - started > timeoutMs) {
      assert.fail("timed out waiting for refreshHostWidget to update the widget");
    }
    await new Promise<void>((resolve) => setImmediate(resolve));
  }
}

async function withIsolatedHostEnv<T>(run: () => Promise<T>): Promise<T> {
  const prev = process.env.PI_WIDGET_HOST_AGENT_DIR;
  const dir = await mkdtemp(join(tmpdir(), "pi-widget-host-refresh-"));

  try {
    process.env.PI_WIDGET_HOST_AGENT_DIR = dir;
    resetHostExtensionStateForTests();
    return await run();
  } finally {
    resetHostExtensionStateForTests();
    if (prev === undefined) delete process.env.PI_WIDGET_HOST_AGENT_DIR;
    else process.env.PI_WIDGET_HOST_AGENT_DIR = prev;
    await rm(dir, { recursive: true, force: true });
  }
}

test("refreshHostWidget schedules stale-TTL re-evaluation with fake timers", async (t) => {
  await withIsolatedHostEnv(async () => {
    const registry = getWidgetHostRegistry();
    registry.clear();

    const entry = baseEntry();
    registry.set(entry);

    await writeHostConfig({
      schemaVersion: 1,
      setupComplete: true,
      demoProviderEnabled: false,
      presetId: "always-demo",
      mutedProviderIds: [],
    });

    const remainingTtlMs = getRemainingTtlMs(entry, FIXED_NOW_MS);
    assert.equal(remainingTtlMs, 5_000);

    t.mock.timers.enable({ apis: ["Date"] });
    t.mock.timers.setTime(FIXED_NOW_MS);

    const scheduled: Array<{ delay: number; run: () => void }> = [];
    const setTimeoutSpy = t.mock.method(globalThis, "setTimeout", (handler: TimerHandler, delay?: number) => {
      if (typeof handler === "function" && typeof delay === "number") {
        scheduled.push({ delay, run: handler as () => void });
      }
      return 1 as unknown as NodeJS.Timeout;
    });

    const ui = createHostUiMock();
    const ctx = { hasUI: true as const, ui };

    try {
      await refreshHostWidget(ctx);
      assert.equal(ui.setWidgetCalls.length, 1);
      assert.equal(ui.setWidgetCalls[0]?.[0], WIDGET_ID);
      assert.deepEqual(ui.setWidgetCalls[0]?.[1], ["refresh-test"]);
      assert.equal(scheduled.length, 1);
      assert.equal(scheduled[0]?.delay, Math.max(remainingTtlMs! + 25, 25));

      scheduled[0]?.run();
      await waitForWidgetRefresh(ui, 1);

      assert.ok(ui.setWidgetCalls.length >= 2, "stale-TTL timer should trigger another refresh");
    } finally {
      setTimeoutSpy.mock.restore();
      t.mock.timers.reset();
    }

    registry.clear();
  });
});

test("ensureRegistryWatcher registers a registry refresh listener", (t) => {
  resetHostExtensionStateForTests();
  try {
    const registry = getWidgetHostRegistry();
    const originalSubscribe = registry.subscribe;
    const subscribeSpy = t.mock.method(registry, "subscribe", (listener: () => void) =>
      originalSubscribe(listener),
    );

    assert.equal(isRegistryWatcherActiveForTests(), false);
    ensureRegistryWatcher();
    assert.equal(isRegistryWatcherActiveForTests(), true);
    ensureRegistryWatcher();
    assert.equal(isRegistryWatcherActiveForTests(), true);
    assert.equal(subscribeSpy.mock.callCount(), 1, "ensureRegistryWatcher must not double-subscribe");
  } finally {
    resetHostExtensionStateForTests();
    assert.equal(isRegistryWatcherActiveForTests(), false);
  }
});

test("registry subscribe callback triggers a host widget refresh", async () => {
  await withIsolatedHostEnv(async () => {
    const registry = getWidgetHostRegistry();
    registry.clear();

    await writeHostConfig({
      schemaVersion: 1,
      setupComplete: true,
      demoProviderEnabled: false,
      presetId: "always-demo",
      mutedProviderIds: [],
    });

    const ui = createHostUiMock();
    const ctx = { hasUI: true as const, ui };
    const nowIso = new Date().toISOString();

    registry.set(
      baseEntry({
        updatedAt: nowIso,
        ttlMs: undefined,
      }),
    );
    await refreshHostWidget(ctx);
    ensureRegistryWatcher();
    assert.equal(isRegistryWatcherActiveForTests(), true);

    const callsAfterInitialRefresh = ui.setWidgetCalls.length;
    assert.ok(callsAfterInitialRefresh >= 1, "initial refresh should update the widget");

    registry.set(
      baseEntry({
        providerId: "provider-b",
        updatedAt: nowIso,
        ttlMs: undefined,
        priority: 30,
        lines: ["from-subscribe"],
      }),
    );

    await waitForWidgetRefresh(ui, callsAfterInitialRefresh);

    assert.equal(ui.setWidgetCalls.at(-1)?.[0], WIDGET_ID);
    assert.deepEqual(ui.setWidgetCalls.at(-1)?.[1], ["from-subscribe"]);

    registry.clear();
  });
});
