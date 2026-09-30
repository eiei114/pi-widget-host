import assert from "node:assert/strict";
import test from "node:test";
import { getWidgetHostRegistry } from "../lib/registry.ts";

test("registry protocol publishes, lists, subscribes, and removes provider entries", () => {
  const registry = getWidgetHostRegistry();
  registry.clear();

  let notifications = 0;
  const dispose = registry.subscribe(() => {
    notifications += 1;
  });

  registry.set({
    providerId: "demo",
    available: true,
    lines: ["hello"],
    updatedAt: "2026-06-15T12:00:00.000Z",
    priority: 10,
    tags: ["music"],
  });
  assert.equal(notifications, 1);

  registry.set({
    providerId: "demo",
    available: true,
    lines: ["hello"],
    updatedAt: "2026-06-15T12:00:00.000Z",
    priority: 10,
    tags: ["music"],
  });
  assert.equal(notifications, 1);
  assert.equal(registry.list()[0]?.providerId, "demo");

  registry.remove("demo");
  assert.equal(notifications, 2);
  assert.deepEqual(registry.list(), []);

  dispose();
  registry.clear();
});

test("repeated registry refreshes replace entries without duplicates and remove stale providers", () => {
  const registry = getWidgetHostRegistry();
  registry.clear();

  let notifications = 0;
  const dispose = registry.subscribe(() => {
    notifications += 1;
  });
  const currentEntry = {
    providerId: "current",
    available: true,
    lines: ["current"],
    updatedAt: "2026-06-15T12:00:00.000Z",
    priority: 20,
    tags: undefined,
    mode: undefined,
    ttlMs: undefined,
  };

  try {
    registry.set({
      providerId: "stale",
      available: true,
      lines: ["stale"],
      updatedAt: "2026-06-15T11:59:00.000Z",
      priority: 10,
    });
    registry.set(currentEntry);
    assert.equal(notifications, 2);

    for (let refresh = 0; refresh < 3; refresh += 1) {
      registry.set(currentEntry);
    }
    assert.equal(notifications, 2, "identical refreshes must not notify");
    registry.remove("stale");
    assert.equal(notifications, 3);
    registry.set(currentEntry);

    assert.deepEqual(registry.list(), [currentEntry]);
    assert.equal(notifications, 3, "re-setting an identical entry must not notify");
  } finally {
    dispose();
    registry.clear();
  }
});
