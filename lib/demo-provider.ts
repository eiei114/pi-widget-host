import { readHostConfig } from "./config.ts";
import { detectTimeBlock } from "./policy.ts";
import { publishProviderEntry, removeProviderEntry } from "./registry.ts";
import { DEMO_PROVIDER_ID, type HostConfig, type ProviderEntry } from "./types.ts";

const HEARTBEAT_MS = 30_000;
const ENTRY_TTL_MS = 90_000;

let heartbeat: NodeJS.Timeout | undefined;

function baseTagsForBlock(block: ReturnType<typeof detectTimeBlock>): string[] {
  switch (block) {
    case "morning":
      return ["music", "idle"];
    case "day":
      return ["sports", "idle"];
    case "evening":
      return ["music", "sports"];
    case "night":
    default:
      return ["idle", "music"];
  }
}

function readEventTags(): string[] {
  const tags: string[] = [];
  if (["1", "true", "yes"].includes(String(process.env.PI_WIDGET_HOST_DEMO_PLAYING_NOW ?? "").toLowerCase())) {
    tags.push("playing-now");
  }
  if (["1", "true", "yes"].includes(String(process.env.PI_WIDGET_HOST_DEMO_MATCHDAY ?? "").toLowerCase())) {
    tags.push("matchday");
  }
  return tags;
}

export function buildDemoProviderEntry(config: HostConfig, now = new Date()): ProviderEntry {
  const block = detectTimeBlock(now);
  const tags = [...new Set([...baseTagsForBlock(block), ...readEventTags()])];

  return {
    providerId: DEMO_PROVIDER_ID,
    available: true,
    updatedAt: now.toISOString(),
    priority: 15,
    ttlMs: ENTRY_TTL_MS,
    tags,
    mode: block,
    lines: [`Widget Host Demo | ${block}`, `preset=${config.presetId} | tags=${tags.join(",")}`],
  };
}

async function heartbeatTick(): Promise<void> {
  const config = await readHostConfig();
  if (!config.demoProviderEnabled) {
    removeProviderEntry(DEMO_PROVIDER_ID);
    stopDemoProviderHeartbeat();
    return;
  }
  publishProviderEntry(buildDemoProviderEntry(config));
}

function ensureHeartbeat(): void {
  if (heartbeat) return;
  heartbeat = setInterval(() => {
    void heartbeatTick().catch(() => undefined);
  }, HEARTBEAT_MS);
}

export async function syncBuiltInDemoProvider(config: HostConfig): Promise<void> {
  if (!config.demoProviderEnabled) {
    removeProviderEntry(DEMO_PROVIDER_ID);
    stopDemoProviderHeartbeat();
    return;
  }

  publishProviderEntry(buildDemoProviderEntry(config));
  ensureHeartbeat();
}

export function stopDemoProviderHeartbeat(): void {
  if (!heartbeat) return;
  clearInterval(heartbeat);
  heartbeat = undefined;
}
