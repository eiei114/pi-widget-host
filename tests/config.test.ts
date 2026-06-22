import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createDefaultConfig, readHostConfig, writeHostConfig } from "../lib/config.ts";
import { resolveConfigPath } from "../lib/types.ts";

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

test("config path defaults to user-global ~/.pi/agent", () => {
  const prev = process.env.PI_WIDGET_HOST_AGENT_DIR;
  try {
    delete process.env.PI_WIDGET_HOST_AGENT_DIR;
    const path = resolveConfigPath();
    assert.match(path, /[\\/]\.pi[\\/]agent[\\/]pi-widget-host-config\.json$/);
  } finally {
    if (prev === undefined) delete process.env.PI_WIDGET_HOST_AGENT_DIR;
    else process.env.PI_WIDGET_HOST_AGENT_DIR = prev;
  }
});

test("setup preset persists across later reads like a new session start", async () => {
  const prev = process.env.PI_WIDGET_HOST_AGENT_DIR;
  const dir = await mkdtemp(join(tmpdir(), "pi-widget-host-config-"));
  try {
    process.env.PI_WIDGET_HOST_AGENT_DIR = dir;
    await writeHostConfig({
      ...createDefaultConfig(),
      setupComplete: true,
      demoProviderEnabled: true,
      presetId: "night-owl",
    });

    const laterSession = await readHostConfig();
    assert.equal(laterSession.setupComplete, true);
    assert.equal(laterSession.demoProviderEnabled, true);
    assert.equal(laterSession.presetId, "night-owl");
  } finally {
    if (prev === undefined) delete process.env.PI_WIDGET_HOST_AGENT_DIR;
    else process.env.PI_WIDGET_HOST_AGENT_DIR = prev;
    await rm(dir, { recursive: true, force: true });
  }
});
