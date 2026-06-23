import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
const readme = await readFile(new URL("../README.md", import.meta.url), "utf8");

test("package exports only extension resources", () => {
  assert.deepEqual(packageJson.pi.extensions, ["./extensions/index.ts"]);
  assert.equal(packageJson.pi.skills, undefined);
  assert.equal(packageJson.pi.prompts, undefined);
  assert.equal(packageJson.pi.themes, undefined);
});

test("package metadata points at pi-widget-host", () => {
  assert.equal(packageJson.name, "pi-widget-host");
  assert.equal(packageJson.version, "0.2.0");
  assert.match(packageJson.repository.url, /eiei114\/pi-widget-host/);
});

test("readme documents host commands", () => {
  assert.match(readme, /\/widget-host:setup/);
  assert.match(readme, /\/widget-host:status/);
  assert.match(readme, /\/widget-host:policy/);
  assert.match(readme, /\/widget-host:providers/);
  assert.match(readme, /\/widget-host:mute/);
  assert.match(readme, /\/widget-host:unmute/);
  assert.match(readme, /globalThis/);
  assert.match(readme, /ttlMs/);
});
