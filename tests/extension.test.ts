import assert from "node:assert/strict";
import test from "node:test";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import widgetHostExtension from "../extensions/index.ts";

test("extension registers global host config and policy commands", () => {
  const commands = new Map<string, { description: string }>();

  const pi = {
    on: () => undefined,
    registerCommand: (name: string, options: { description: string }) => {
      commands.set(name, options);
    },
  } as unknown as ExtensionAPI;

  widgetHostExtension(pi);

  assert.ok(commands.has("widget-host:setup"));
  assert.ok(commands.has("widget-host:status"));
  assert.ok(commands.has("widget-host:policy"));
  assert.match(commands.get("widget-host:setup")?.description ?? "", /demo provider/i);
  assert.match(commands.get("widget-host:status")?.description ?? "", /setup/i);
  assert.match(commands.get("widget-host:policy")?.description ?? "", /preset/i);
});

test("extension registers provider inventory and visibility commands", () => {
  const commands = new Map<string, { description: string }>();

  const pi = {
    on: () => undefined,
    registerCommand: (name: string, options: { description: string }) => {
      commands.set(name, options);
    },
  } as unknown as ExtensionAPI;

  widgetHostExtension(pi);

  assert.ok(commands.has("widget-host:providers"));
  assert.ok(commands.has("widget-host:mute"));
  assert.ok(commands.has("widget-host:unmute"));
  assert.match(commands.get("widget-host:providers")?.description ?? "", /provider/i);
  assert.match(commands.get("widget-host:mute")?.description ?? "", /mute/i);
  assert.match(commands.get("widget-host:unmute")?.description ?? "", /unmute/i);
});
