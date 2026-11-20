import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, test } from "node:test";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import widgetHostExtension, { resetHostExtensionStateForTests } from "../extensions/index.ts";
import { createDefaultConfig, readHostConfig, writeHostConfig } from "../lib/config.ts";
import { PRESET_OPTIONS } from "../lib/policy.ts";
import { clearHostPresent, getWidgetHostRegistry, listProviderEntries } from "../lib/registry.ts";
import { DEMO_PROVIDER_ID, type HostConfig } from "../lib/types.ts";

interface TestContext {
  hasUI: boolean;
  ui: {
    select: (prompt: string, options: string[]) => Promise<string | undefined>;
    notify: (message: string, level: "info" | "warning" | "error") => void;
    setWidget: (id: string, lines: string[] | undefined) => void;
    setStatus: (key: string, value: string | undefined) => void;
  };
}

type CommandHandler = (args: string, ctx: TestContext) => Promise<void>;

interface Harness {
  commands: Map<string, CommandHandler>;
  events: Map<string, (event: unknown, ctx: TestContext) => Promise<void> | void>;
  prompts: { prompt: string; options: string[] }[];
  notifications: { message: string; level: "info" | "warning" | "error" }[];
  ctx: TestContext;
}

let tempDir: string;
let previousAgentDir: string | undefined;

beforeEach(async () => {
  resetHostExtensionStateForTests();
  getWidgetHostRegistry().clear();
  previousAgentDir = process.env.PI_WIDGET_HOST_AGENT_DIR;
  tempDir = await mkdtemp(join(tmpdir(), "pi-widget-host-command-handlers-"));
  process.env.PI_WIDGET_HOST_AGENT_DIR = tempDir;
});

afterEach(async () => {
  resetHostExtensionStateForTests();
  clearHostPresent();
  getWidgetHostRegistry().clear();
  if (previousAgentDir === undefined) delete process.env.PI_WIDGET_HOST_AGENT_DIR;
  else process.env.PI_WIDGET_HOST_AGENT_DIR = previousAgentDir;
  await rm(tempDir, { recursive: true, force: true });
});

function createHarness(answers: Array<string | undefined> = [], hasUI = true): Harness {
  const commands = new Map<string, CommandHandler>();
  const events = new Map<string, (event: unknown, ctx: TestContext) => Promise<void> | void>();
  const prompts: Harness["prompts"] = [];
  const notifications: Harness["notifications"] = [];
  const pi = {
    on: (event: string, handler: (event: unknown, ctx: TestContext) => Promise<void> | void) => {
      events.set(event, handler);
    },
    registerCommand: (name: string, options: { handler: unknown }) => {
      commands.set(name, options.handler as CommandHandler);
    },
  } as unknown as ExtensionAPI;

  widgetHostExtension(pi);

  return {
    commands,
    events,
    prompts,
    notifications,
    ctx: {
      hasUI,
      ui: {
        select: async (prompt, options) => {
          prompts.push({ prompt, options: [...options] });
          return answers.shift();
        },
        notify: (message, level) => notifications.push({ message, level }),
        setWidget: () => undefined,
        setStatus: () => undefined,
      },
    },
  };
}

async function invoke(harness: Harness, command: string): Promise<void> {
  const handler = harness.commands.get(`widget-host:${command}`);
  assert.ok(handler, `expected widget-host:${command} to be registered`);
  await handler("", harness.ctx);
}

async function seedConfig(overrides: Partial<HostConfig> = {}): Promise<HostConfig> {
  return writeHostConfig({ ...createDefaultConfig(), ...overrides });
}

function registerProvider(providerId: string, priority: number): void {
  getWidgetHostRegistry().set({
    providerId,
    available: true,
    lines: [`${providerId} widget`],
    updatedAt: new Date().toISOString(),
    priority,
    tags: [],
    ttlMs: 60_000,
  });
}

function presetOption(id: string): string {
  const preset = PRESET_OPTIONS.find((option) => option.id === id);
  assert.ok(preset, `expected preset ${id}`);
  return `${preset.label} — ${preset.description}`;
}

test("setup enables and registers the demo provider with the selected preset", async () => {
  const harness = createHarness(["Enable demo provider", presetOption("focus-day")]);
  await harness.events.get("session_start")?.({}, harness.ctx);

  await invoke(harness, "setup");

  const config = await readHostConfig();
  assert.equal(config.setupComplete, true);
  assert.equal(config.demoProviderEnabled, true);
  assert.equal(config.presetId, "focus-day");
  assert.ok(listProviderEntries().some((entry) => entry.providerId === DEMO_PROVIDER_ID));
  assert.match(harness.notifications[0]?.message ?? "", /^Saved setup\./);
  assert.match(harness.notifications[0]?.message ?? "", /Preset: Focus day/);
  assert.equal(harness.notifications[0]?.level, "info");
});

test("setup can keep the host silent without registering the demo provider", async () => {
  const harness = createHarness(["Keep host silent", presetOption("night-owl")]);

  await invoke(harness, "setup");

  const config = await readHostConfig();
  assert.equal(config.setupComplete, true);
  assert.equal(config.demoProviderEnabled, false);
  assert.equal(config.presetId, "night-owl");
  assert.equal(listProviderEntries().some((entry) => entry.providerId === DEMO_PROVIDER_ID), false);
  assert.match(harness.notifications[0]?.message ?? "", /^Saved setup\./);
  assert.match(harness.notifications[0]?.message ?? "", /Demo provider: disabled/);
});

test("setup cancellation at the demo prompt leaves config and registry unchanged", async () => {
  const harness = createHarness([undefined]);
  await invoke(harness, "setup");
  assert.deepEqual(await readdir(tempDir), []);
  assert.deepEqual(listProviderEntries(), []);
  assert.deepEqual(harness.notifications, []);
});

test("setup cancellation at the preset prompt leaves config and registry unchanged", async () => {
  const harness = createHarness(["Enable demo provider", undefined]);
  await invoke(harness, "setup");
  assert.deepEqual(await readdir(tempDir), []);
  assert.deepEqual(listProviderEntries(), []);
  assert.deepEqual(harness.notifications, []);
});

test("policy Show policy notifies the current description without writing config", async () => {
  await seedConfig({ presetId: "night-owl" });
  const before = await readFile(join(tempDir, "pi-widget-host-config.json"), "utf8");
  const harness = createHarness(["Show policy"]);

  await invoke(harness, "policy");

  assert.match(harness.notifications[0]?.message ?? "", /Stay quiet during work hours and show the shared slot in evening and night\./);
  assert.equal(harness.notifications[0]?.level, "info");
  assert.equal(await readFile(join(tempDir, "pi-widget-host-config.json"), "utf8"), before);
  assert.deepEqual(harness.prompts[0]?.options, ["Show policy", "Change preset"]);
});

test("policy Change preset persists the new preset and notifies", async () => {
  await seedConfig({ presetId: "always-demo" });
  const harness = createHarness(["Change preset", presetOption("focus-day")]);

  await invoke(harness, "policy");

  const config = await readHostConfig();
  assert.equal(config.setupComplete, true);
  assert.equal(config.presetId, "focus-day");
  assert.match(harness.notifications[0]?.message ?? "", /^Policy saved: Focus day\./);
  assert.match(harness.notifications[0]?.message ?? "", /Active provider: none/);
});

test("policy cancellation at the action prompt leaves the saved config unchanged", async () => {
  const original = await seedConfig({ presetId: "night-owl", setupComplete: true });
  const before = await readFile(join(tempDir, "pi-widget-host-config.json"), "utf8");
  const harness = createHarness([undefined]);

  await invoke(harness, "policy");

  assert.deepEqual(await readHostConfig(), original);
  assert.equal(await readFile(join(tempDir, "pi-widget-host-config.json"), "utf8"), before);
  assert.deepEqual(harness.notifications, []);
});

test("policy cancellation at the preset prompt leaves the saved config unchanged", async () => {
  const original = await seedConfig({ presetId: "night-owl", setupComplete: true });
  const before = await readFile(join(tempDir, "pi-widget-host-config.json"), "utf8");
  const harness = createHarness(["Change preset", undefined]);

  await invoke(harness, "policy");

  assert.deepEqual(await readHostConfig(), original);
  assert.equal(await readFile(join(tempDir, "pi-widget-host-config.json"), "utf8"), before);
  assert.deepEqual(harness.notifications, []);
});

test("mute persists a selected provider once and notifies the newly active provider", async () => {
  registerProvider("provider-a", 20);
  registerProvider("provider-b", 10);
  const harness = createHarness(["provider-a — active"]);

  await invoke(harness, "mute");

  assert.deepEqual((await readHostConfig()).mutedProviderIds, ["provider-a"]);
  assert.match(harness.notifications[0]?.message ?? "", /^Muted provider-a\. Active provider: provider-b$/);
  assert.equal(harness.notifications[0]?.level, "info");
  assert.deepEqual(harness.prompts[0]?.options, ["provider-a — active", "provider-b — eligible"]);
});

test("mute warns when all registered providers are already muted", async () => {
  registerProvider("provider-a", 20);
  registerProvider("provider-b", 10);
  await seedConfig({ mutedProviderIds: ["provider-a", "provider-b"] });
  const harness = createHarness();

  await invoke(harness, "mute");

  assert.deepEqual(harness.notifications, [{ message: "No unmuted providers available.", level: "warning" }]);
  assert.deepEqual(harness.prompts, []);
});

test("mute maps labels back to provider ids containing the label delimiter", async () => {
  const providerId = "provider — with delimiter";
  registerProvider(providerId, 20);
  registerProvider("other-provider", 10);
  const harness = createHarness([`${providerId} — active`]);

  await invoke(harness, "mute");

  assert.deepEqual((await readHostConfig()).mutedProviderIds, [providerId]);
  assert.match(harness.notifications[0]?.message ?? "", new RegExp(`^Muted ${providerId}\\. Active provider: other-provider$`));
});

test("mute cancellation does not change config", async () => {
  registerProvider("provider-a", 20);
  const original = await seedConfig();
  const before = await readFile(join(tempDir, "pi-widget-host-config.json"), "utf8");
  const harness = createHarness([undefined]);

  await invoke(harness, "mute");

  assert.deepEqual(await readHostConfig(), original);
  assert.equal(await readFile(join(tempDir, "pi-widget-host-config.json"), "utf8"), before);
  assert.deepEqual(harness.notifications, []);
});

test("unmute warns when there are no muted providers", async () => {
  const harness = createHarness();

  await invoke(harness, "unmute");

  assert.deepEqual(harness.notifications, [{ message: "No muted providers stored in config.", level: "warning" }]);
  assert.deepEqual(harness.prompts, []);
});

test("unmute removes the selected provider and notifies", async () => {
  registerProvider("provider-a", 20);
  registerProvider("provider-b", 10);
  await seedConfig({ mutedProviderIds: ["provider-a", "provider-b"] });
  const harness = createHarness(["provider-a"]);

  await invoke(harness, "unmute");

  assert.deepEqual((await readHostConfig()).mutedProviderIds, ["provider-b"]);
  assert.match(harness.notifications[0]?.message ?? "", /^Unmuted provider-a\. Active provider: provider-a$/);
  assert.equal(harness.notifications[0]?.level, "info");
});

test("unmute cancellation does not change config", async () => {
  await seedConfig({ mutedProviderIds: ["provider-a"] });
  const before = await readFile(join(tempDir, "pi-widget-host-config.json"), "utf8");
  const harness = createHarness([undefined]);

  await invoke(harness, "unmute");

  assert.deepEqual((await readHostConfig()).mutedProviderIds, ["provider-a"]);
  assert.equal(await readFile(join(tempDir, "pi-widget-host-config.json"), "utf8"), before);
  assert.deepEqual(harness.notifications, []);
});

test("interactive commands do not prompt or write config without Pi UI", async () => {
  const original = await seedConfig();
  const before = await readFile(join(tempDir, "pi-widget-host-config.json"), "utf8");

  for (const command of ["setup", "policy", "mute", "unmute"]) {
    const harness = createHarness([], false);
    await invoke(harness, command);
    assert.deepEqual(harness.prompts, [], `${command} should not prompt without UI`);
    assert.deepEqual(await readHostConfig(), original, `${command} should not change config without UI`);
  }

  assert.equal(await readFile(join(tempDir, "pi-widget-host-config.json"), "utf8"), before);
});

test("status and providers do not throw without Pi UI", async () => {
  for (const command of ["status", "providers"]) {
    const harness = createHarness([], false);
    await assert.doesNotReject(invoke(harness, command));
    assert.deepEqual(harness.prompts, []);
    assert.deepEqual(harness.notifications, []);
  }
});
