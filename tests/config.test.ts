import assert from "node:assert/strict";
import {
  lstat,
  mkdtemp,
  readFile as readFileFromDisk,
  readdir,
  rename as renameFromDisk,
  rm,
  symlink,
  unlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { writeFileAtomically } from "../lib/atomic-write.ts";
import { createDefaultConfig, readHostConfig, writeHostConfig } from "../lib/config.ts";
import { resolveConfigPath } from "../lib/types.ts";

test("config store falls back to defaults and persists valid values", async () => {
  const prev = process.env.PI_WIDGET_HOST_AGENT_DIR;
  const dir = await mkdtemp(join(tmpdir(), "pi-widget-host-config-"));
  try {
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

    assert.deepEqual(await readdir(dir), ["pi-widget-host-config.json"]);
  } finally {
    if (prev === undefined) delete process.env.PI_WIDGET_HOST_AGENT_DIR;
    else process.env.PI_WIDGET_HOST_AGENT_DIR = prev;
    await rm(dir, { recursive: true, force: true });
  }
});

test("failed atomic config replacement keeps the previous config and removes its temp file", async () => {
  const prev = process.env.PI_WIDGET_HOST_AGENT_DIR;
  const dir = await mkdtemp(join(tmpdir(), "pi-widget-host-config-"));
  try {
    process.env.PI_WIDGET_HOST_AGENT_DIR = dir;
    const previousConfig = {
      ...createDefaultConfig(),
      setupComplete: true,
      demoProviderEnabled: true,
      presetId: "night-owl",
      mutedProviderIds: ["alpha"],
    };
    await writeHostConfig(previousConfig);

    let renameAttempts = 0;
    const failingOperations = {
      writeFile,
      unlink,
      rename: async () => {
        renameAttempts += 1;
        throw new Error("simulated replacement failure");
      },
    };

    await assert.rejects(
      writeFileAtomically(resolveConfigPath(), '{"setupComplete":false}\n', failingOperations),
      /simulated replacement failure/,
    );

    assert.equal(renameAttempts, 1);
    assert.deepEqual(await readHostConfig(), previousConfig);
    assert.deepEqual(await readdir(dir), ["pi-widget-host-config.json"]);
    assert.equal(
      await readFileFromDisk(resolveConfigPath(), "utf8"),
      `${JSON.stringify(previousConfig, null, 2)}\n`,
    );
  } finally {
    if (prev === undefined) delete process.env.PI_WIDGET_HOST_AGENT_DIR;
    else process.env.PI_WIDGET_HOST_AGENT_DIR = prev;
    await rm(dir, { recursive: true, force: true });
  }
});

test("atomic config writes update a symlink target without replacing the link", async () => {
  const prev = process.env.PI_WIDGET_HOST_AGENT_DIR;
  const dir = await mkdtemp(join(tmpdir(), "pi-widget-host-config-"));
  try {
    process.env.PI_WIDGET_HOST_AGENT_DIR = dir;
    const configPath = resolveConfigPath();
    const canonicalPath = join(dir, "canonical-config.json");
    const config = { ...createDefaultConfig(), setupComplete: true, presetId: "night-owl" };
    const expected = `${JSON.stringify(config, null, 2)}\n`;
    await writeFile(canonicalPath, "{}\n", "utf8");
    await symlink(canonicalPath, configPath, "file");

    assert.deepEqual(await writeHostConfig(config), config);

    assert.equal((await lstat(configPath)).isSymbolicLink(), true);
    assert.equal(await readFileFromDisk(canonicalPath, "utf8"), expected);
    assert.deepEqual(await readHostConfig(), config);
    assert.deepEqual((await readdir(dir)).sort(), ["canonical-config.json", "pi-widget-host-config.json"].sort());
  } finally {
    if (prev === undefined) delete process.env.PI_WIDGET_HOST_AGENT_DIR;
    else process.env.PI_WIDGET_HOST_AGENT_DIR = prev;
    await rm(dir, { recursive: true, force: true });
  }
});

test("atomic config replacement retries transient temp cleanup failures and preserves the rename error", async () => {
  const prev = process.env.PI_WIDGET_HOST_AGENT_DIR;
  const dir = await mkdtemp(join(tmpdir(), "pi-widget-host-config-"));
  try {
    process.env.PI_WIDGET_HOST_AGENT_DIR = dir;
    const previousConfig = { ...createDefaultConfig(), setupComplete: true, presetId: "night-owl" };
    await writeHostConfig(previousConfig);

    let unlinkAttempts = 0;
    const renameFailure = new Error("simulated replacement failure");
    const operations = {
      writeFile,
      rename: async () => {
        throw renameFailure;
      },
      unlink: async (path: Parameters<typeof unlink>[0]) => {
        unlinkAttempts += 1;
        if (unlinkAttempts === 1) throw Object.assign(new Error("file is busy"), { code: "EBUSY" });
        await unlink(path);
      },
    };

    await assert.rejects(
      writeFileAtomically(resolveConfigPath(), '{"setupComplete":false}\n', operations),
      (error) => error === renameFailure,
    );

    assert.equal(unlinkAttempts, 2);
    assert.deepEqual(await readHostConfig(), previousConfig);
    assert.deepEqual(await readdir(dir), ["pi-widget-host-config.json"]);
  } finally {
    if (prev === undefined) delete process.env.PI_WIDGET_HOST_AGENT_DIR;
    else process.env.PI_WIDGET_HOST_AGENT_DIR = prev;
    await rm(dir, { recursive: true, force: true });
  }
});

test("atomic config replacement retries transient Windows rename locks", async () => {
  const prev = process.env.PI_WIDGET_HOST_AGENT_DIR;
  const dir = await mkdtemp(join(tmpdir(), "pi-widget-host-config-"));
  try {
    process.env.PI_WIDGET_HOST_AGENT_DIR = dir;
    await writeHostConfig({ ...createDefaultConfig(), setupComplete: true });

    let renameAttempts = 0;
    const operations = {
      writeFile,
      unlink,
      rename: async (from: Parameters<typeof renameFromDisk>[0], to: Parameters<typeof renameFromDisk>[1]) => {
        renameAttempts += 1;
        if (renameAttempts < 3) throw Object.assign(new Error("file is busy"), { code: "EPERM" });
        await renameFromDisk(from, to);
      },
    };
    const replacement = `${JSON.stringify({ ...createDefaultConfig(), setupComplete: true, presetId: "night-owl" }, null, 2)}\n`;

    await writeFileAtomically(resolveConfigPath(), replacement, operations);

    assert.equal(renameAttempts, 3);
    assert.equal(await readFileFromDisk(resolveConfigPath(), "utf8"), replacement);
    assert.deepEqual(await readdir(dir), ["pi-widget-host-config.json"]);
  } finally {
    if (prev === undefined) delete process.env.PI_WIDGET_HOST_AGENT_DIR;
    else process.env.PI_WIDGET_HOST_AGENT_DIR = prev;
    await rm(dir, { recursive: true, force: true });
  }
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

test("readHostConfig normalizes malformed payloads to the default config shape", async () => {
  const prev = process.env.PI_WIDGET_HOST_AGENT_DIR;
  const dir = await mkdtemp(join(tmpdir(), "pi-widget-host-config-"));
  try {
    process.env.PI_WIDGET_HOST_AGENT_DIR = dir;
    const configPath = resolveConfigPath();

    await writeFile(configPath, JSON.stringify("not-an-object"), "utf8");
    assert.deepEqual(await readHostConfig(), createDefaultConfig());

    await writeFile(configPath, JSON.stringify({ presetId: "bogus-preset" }), "utf8");
    assert.deepEqual(await readHostConfig(), createDefaultConfig());

    await writeFile(configPath, JSON.stringify({ mutedProviderIds: "alpha" }), "utf8");
    assert.deepEqual(await readHostConfig(), createDefaultConfig());

    await writeFile(configPath, "not-json", "utf8");
    assert.deepEqual(await readHostConfig(), createDefaultConfig());
  } finally {
    if (prev === undefined) delete process.env.PI_WIDGET_HOST_AGENT_DIR;
    else process.env.PI_WIDGET_HOST_AGENT_DIR = prev;
    await rm(dir, { recursive: true, force: true });
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
