import { createProviderRuntime, type ProviderRuntime } from "pi-widget-core/provider";
import { readHostConfig } from "./config.ts";
import { detectTimeBlock } from "./policy.ts";
import { DEMO_PROVIDER_ID, type HostConfig, type ProviderEntry } from "./types.ts";

const HEARTBEAT_MS = 30_000;
const ENTRY_TTL_MS = 90_000;

let heartbeat: NodeJS.Timeout | undefined;
let runtime: ProviderRuntime | undefined;

function ensureRuntime(): ProviderRuntime {
  runtime ??= createProviderRuntime({ providerId: DEMO_PROVIDER_ID });
  return runtime;
}

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
    stopDemoProviderHeartbeat();
    return;
  }
  ensureRuntime().update(buildDemoProviderEntry(config));
}

function ensureHeartbeat(): void {
  if (heartbeat) return;
  heartbeat = setInterval(() => {
    void heartbeatTick().catch(() => undefined);
  }, HEARTBEAT_MS);
}

export async function syncBuiltInDemoProvider(config: HostConfig): Promise<void> {
  if (!config.demoProviderEnabled) {
    stopDemoProviderHeartbeat();
    return;
  }

  ensureRuntime().update(buildDemoProviderEntry(config));
  ensureHeartbeat();
}

export function stopDemoProviderHeartbeat(): void {
  if (heartbeat) {
    clearInterval(heartbeat);
    heartbeat = undefined;
  }
  runtime?.stop();
  runtime = undefined;
}
