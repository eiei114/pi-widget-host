import { homedir } from "node:os";
import { join } from "node:path";
import { REGISTRY_SYMBOL, type ProviderEntry } from "pi-widget-core/protocol";

export const PACKAGE_NAME = "pi-widget-host";
export const WIDGET_ID = PACKAGE_NAME;
export const DEMO_PROVIDER_ID = `${PACKAGE_NAME}.demo`;
export { REGISTRY_SYMBOL, type ProviderEntry };

export type HostTimeBlock = "morning" | "day" | "evening" | "night";
export type KnownHostTag = "music" | "sports" | "playing-now" | "matchday" | "idle";

export interface BlockPolicy {
  allowedProviderIds?: string[];
  preferredTags?: KnownHostTag[];
}

export interface PolicyPreset {
  id: string;
  label: string;
  description: string;
  blocks: Record<HostTimeBlock, BlockPolicy>;
}

export interface HostConfig {
  schemaVersion: 1;
  setupComplete: boolean;
  demoProviderEnabled: boolean;
  presetId: string;
  mutedProviderIds: string[];
}

export interface ProviderState extends ProviderEntry {
  effectiveStatus: "active" | "eligible" | "muted" | "stale" | "unavailable";
  effectivePriority: number;
  knownTags: KnownHostTag[];
  reasons: string[];
  isMuted: boolean;
  isStale: boolean;
}

export interface PolicyEvaluationResult {
  timeBlock: HostTimeBlock;
  preset: PolicyPreset;
  providerStates: ProviderState[];
  activeProvider?: ProviderState;
}

export function resolveAgentDir(): string {
  const override = process.env.PI_WIDGET_HOST_AGENT_DIR?.trim();
  return override ? override : join(homedir(), ".pi", "agent");
}

export function resolveConfigPath(): string {
  return join(resolveAgentDir(), `${PACKAGE_NAME}-config.json`);
}
