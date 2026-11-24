import { lstat, mkdir, readFile, readlink, realpath } from "node:fs/promises";
import { dirname, isAbsolute, resolve } from "node:path";
import { writeFileAtomically } from "./atomic-write.ts";
import { DEFAULT_PRESET_ID, getPreset } from "./policy.ts";
import { resolveConfigPath, type HostConfig } from "./types.ts";

export function createDefaultConfig(): HostConfig {
  return {
    schemaVersion: 1,
    setupComplete: false,
    demoProviderEnabled: false,
    presetId: DEFAULT_PRESET_ID,
    mutedProviderIds: [],
  };
}

function normalizeConfig(input: unknown): HostConfig {
  const value = typeof input === "object" && input !== null ? (input as Partial<HostConfig>) : {};
  const presetId = typeof value.presetId === "string" ? getPreset(value.presetId).id : DEFAULT_PRESET_ID;
  const mutedProviderIds = Array.isArray(value.mutedProviderIds)
    ? [...new Set(value.mutedProviderIds
        .filter((item) => typeof item === "string")
        .map((id) => id.trim())
        .filter((id) => id.length > 0))]
    : [];

  return {
    schemaVersion: 1,
    setupComplete: value.setupComplete === true,
    demoProviderEnabled: value.demoProviderEnabled === true,
    presetId,
    mutedProviderIds,
  };
}

async function resolveConfigWritePath(path: string): Promise<string> {
  try {
    return await realpath(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;

    try {
      const info = await lstat(path);
      if (!info.isSymbolicLink()) return path;

      const target = await readlink(path);
      const resolvedTarget = isAbsolute(target) ? target : resolve(dirname(path), target);
      return resolveConfigWritePath(resolvedTarget);
    } catch (linkError) {
      if ((linkError as NodeJS.ErrnoException).code === "ENOENT") return path;
      throw linkError;
    }
  }
}

type ConfigFileReader = (path: string, encoding: BufferEncoding) => Promise<string>;

export async function readHostConfig(readConfigFile: ConfigFileReader = readFile): Promise<HostConfig> {
  let content: string;
  try {
    content = await readConfigFile(resolveConfigPath(), "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    return createDefaultConfig();
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return createDefaultConfig();
  }
  return normalizeConfig(parsed);
}

export async function writeHostConfig(config: HostConfig): Promise<HostConfig> {
  const normalized = normalizeConfig(config);
  const path = resolveConfigPath();
  await mkdir(dirname(path), { recursive: true });
  await writeFileAtomically(await resolveConfigWritePath(path), `${JSON.stringify(normalized, null, 2)}\n`);
  return normalized;
}

let updateQueue: Promise<void> = Promise.resolve();

export function updateHostConfig(
  mutator: (config: HostConfig) => HostConfig,
  readConfigFile: ConfigFileReader = readFile,
): Promise<HostConfig> {
  const update = updateQueue.then(async () => {
    const current = await readHostConfig(readConfigFile);
    return writeHostConfig(mutator(current));
  });
  updateQueue = update.then(() => undefined, () => undefined);
  return update;
}
