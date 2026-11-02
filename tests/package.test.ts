import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
const packageLock = JSON.parse(await readFile(new URL("../package-lock.json", import.meta.url), "utf8"));
const readme = await readFile(new URL("../README.md", import.meta.url), "utf8");
const contributing = await readFile(new URL("../CONTRIBUTING.md", import.meta.url), "utf8");
const releaseDoc = await readFile(new URL("../docs/release.md", import.meta.url), "utf8");
const autoReleaseWorkflow = await readFile(new URL("../.github/workflows/auto-release.yml", import.meta.url), "utf8");
const publishWorkflow = await readFile(new URL("../.github/workflows/publish.yml", import.meta.url), "utf8");
const changelog = await readFile(new URL("../CHANGELOG.md", import.meta.url), "utf8");
const roadmap = await readFile(new URL("../ROADMAP.md", import.meta.url), "utf8");
const docsIndex = await readFile(new URL("../docs/README.md", import.meta.url), "utf8");

test("package exports only extension resources", () => {
  assert.deepEqual(packageJson.pi.extensions, ["./extensions/index.ts"]);
  assert.equal(packageJson.pi.skills, undefined);
  assert.equal(packageJson.pi.prompts, undefined);
  assert.equal(packageJson.pi.themes, undefined);
});

test("production dependency floors match lockfile resolutions", () => {
  for (const [name, range] of Object.entries(packageJson.dependencies ?? {})) {
    const resolved = packageLock.packages[`node_modules/${name}`]?.version;
    assert.ok(resolved, `missing lockfile resolution for ${name}`);
    assert.equal(range, `^${resolved}`, `${name} floor should match the resolved lockfile version`);
  }
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

test("roadmap reports package and published versions separately", () => {
  const escapedVersion = packageJson.version.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const publishedVersion = roadmap.match(/\| Published version \(npm `latest`\) \| `(\d+\.\d+\.\d+)` \|/)?.[1];
  assert.ok(publishedVersion, "roadmap should record the published npm version");
  assert.ok(roadmap.includes("| Latest GitHub release | [`v" + publishedVersion + "`]"));
  assert.match(roadmap, new RegExp(`\`package\.json\` version \\| \`${escapedVersion}\``));
  assert.doesNotMatch(roadmap, /No provider example/i);
  assert.match(roadmap, /docs\/provider-example\.md/);
});

test("contributing release instructions match trusted publishing workflow", () => {
  assert.match(contributing, /npm version patch/);
  assert.match(contributing, /git push/);
  assert.doesNotMatch(contributing, /follow-tags/);
  assert.match(releaseDoc, /auto-release\.yml/);
  assert.match(releaseDoc, /publish\.yml/);
  assert.doesNotMatch(releaseDoc, /follow-tags/);
});

test("package version pushes cannot start release or publish workflows", () => {
  assert.match(autoReleaseWorkflow, /^on:\r?\n  workflow_dispatch:\r?$/m);
  assert.match(autoReleaseWorkflow, /^    if: github\.ref == 'refs\/heads\/main'$/m);
  assert.doesNotMatch(autoReleaseWorkflow, /^  push:/m);
  assert.match(publishWorkflow, /^on:\r?\n  release:/m);
  assert.match(publishWorkflow, /^  workflow_dispatch:/m);
  assert.doesNotMatch(publishWorkflow, /^  push:/m);
});

test("docs index links the registry and maintenance docs", () => {
  assert.match(docsIndex, /\]\(protocol\.md\)/);
  assert.match(docsIndex, /\]\(provider-example\.md\)/);
  assert.match(docsIndex, /\]\(release\.md\)/);
  assert.match(
    docsIndex,
    /\]\(https:\/\/github\.com\/eiei114\/pi-widget-host\/blob\/main\/ROADMAP\.md\)/,
  );
  assert.match(readme, /\| `docs\/README\.md` \|/);
});

test("readme documents host commands", () => {
  const quickStart = readme.split("## Quick start")[1]?.split("\n## ")[0] ?? "";
  assert.match(quickStart, /pi -e npm:pi-widget-host/);
  assert.match(quickStart, /\/widget-host:setup/);

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
  assert.match(readme, /docs\/provider-example\.md/);
});
