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
