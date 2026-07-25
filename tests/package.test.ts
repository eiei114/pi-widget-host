import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
const readme = await readFile(new URL("../README.md", import.meta.url), "utf8");
const contributing = await readFile(new URL("../CONTRIBUTING.md", import.meta.url), "utf8");
const releaseDoc = await readFile(new URL("../docs/release.md", import.meta.url), "utf8");
const changelog = await readFile(new URL("../CHANGELOG.md", import.meta.url), "utf8");
const roadmap = await readFile(new URL("../ROADMAP.md", import.meta.url), "utf8");

test("package exports only extension resources", () => {
  assert.deepEqual(packageJson.pi.extensions, ["./extensions/index.ts"]);
  assert.equal(packageJson.pi.skills, undefined);
  assert.equal(packageJson.pi.prompts, undefined);
  assert.equal(packageJson.pi.themes, undefined);
});

test("package metadata points at pi-widget-host", () => {
  assert.equal(packageJson.name, "pi-widget-host");
  assert.match(packageJson.version, /^\d+\.\d+\.\d+$/);
  assert.match(packageJson.repository.url, /eiei114\/pi-widget-host/);
});

test("changelog documents the current package version", () => {
  const escapedVersion = packageJson.version.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const versionSection = new RegExp(`## \\[${escapedVersion}\\]`);
  assert.match(changelog, versionSection);

  const unreleasedMatch = changelog.match(/## Unreleased\s*\n([\s\S]*?)(?=\n## |$)/);
  if (unreleasedMatch) {
    assert.match(unreleasedMatch[1] ?? "", /^\s*$/);
  }
});

test("roadmap reflects the current package version", () => {
  const escapedVersion = packageJson.version.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  assert.match(roadmap, new RegExp(`Published version \\(npm \`latest\`\\) \\| \`${escapedVersion}\``));
  assert.match(roadmap, new RegExp(`\`package\.json\` version \\| \`${escapedVersion}\``));
  assert.match(roadmap, new RegExp(`\\[\`v${escapedVersion}\`\\]`));
});

test("contributing release instructions match trusted publishing workflow", () => {
  assert.match(contributing, /npm version patch/);
  assert.match(contributing, /git push/);
  assert.doesNotMatch(contributing, /follow-tags/);
  assert.match(releaseDoc, /auto-release\.yml/);
  assert.match(releaseDoc, /publish\.yml/);
  assert.doesNotMatch(releaseDoc, /follow-tags/);
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
  assert.match(readme, /event boost/i);
  assert.match(readme, /playing-now/);
  assert.match(readme, /matchday/);
  assert.match(readme, /Host-only MVP/i);
  assert.match(readme, /demo provider/i);
});
