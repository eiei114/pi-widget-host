import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
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
    ? [...new Set(value.mutedProviderIds.filter((item): item is string => typeof item === "string" && item.trim().length > 0))]
    : [];

  return {
    schemaVersion: 1,
    setupComplete: value.setupComplete === true,
    demoProviderEnabled: value.demoProviderEnabled === true,
    presetId,
    mutedProviderIds,
  };
}

export async function readHostConfig(): Promise<HostConfig> {
  try {
    const content = await readFile(resolveConfigPath(), "utf8");
    return normalizeConfig(JSON.parse(content));
  } catch {
    return createDefaultConfig();
  }
}

export async function writeHostConfig(config: HostConfig): Promise<HostConfig> {
  const normalized = normalizeConfig(config);
  const path = resolveConfigPath();
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(normalized, null, 2)}\n`, "utf8");
  return normalized;
}

export async function updateHostConfig(mutator: (config: HostConfig) => HostConfig): Promise<HostConfig> {
  const current = await readHostConfig();
  return writeHostConfig(mutator(current));
}
