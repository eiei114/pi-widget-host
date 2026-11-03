import { createProviderRuntime, type ProviderRuntime } from "pi-widget-core/provider";
import { readHostConfig } from "./config.ts";
import { DEFAULT_PRESET_ID, detectTimeBlock, getBlockPreferredTags, getPreset, getRemainingTtlMs } from "./policy.ts";
import { DEMO_PROVIDER_ID, type HostConfig, type ProviderEntry } from "./types.ts";

const HEARTBEAT_MS = 30_000;
const ENTRY_TTL_MS = 90_000;

let heartbeat: NodeJS.Timeout | undefined;
let runtime: ProviderRuntime | undefined;
let publishedEntry: ProviderEntry | undefined;

function ensureRuntime(): ProviderRuntime {
  runtime ??= createProviderRuntime({ providerId: DEMO_PROVIDER_ID });
  return runtime;
}

/**
 * Identity of a demo entry, ignoring `updatedAt`.
 *
 * `buildDemoProviderEntry` stamps a fresh `updatedAt` on every call, so comparing
 * whole entries never matches. `updatedAt` is not rendered content: it only tracks
 * freshness, and the heartbeat is what advances it.
 */
function isSameContent(left: ProviderEntry, right: ProviderEntry): boolean {
  return JSON.stringify({ ...left, updatedAt: "" }) === JSON.stringify({ ...right, updatedAt: "" });
}

/**
 * Publishes only when the rendered content changed, or when the entry already in
 * the registry has gone stale.
 *
 * The host registry notifies subscribers on every publish, and the host's registry
 * watcher re-enters `refreshHostWidget` on that notification, which calls back into
 * `syncBuiltInDemoProvider`. Republishing an unchanged, still-fresh entry therefore
 * feeds the host its own echo and the refresh loop never settles. This guard is what
 * keeps that loop bounded.
 *
 * Staleness is the deliberate exception: a refresh is the only thing that can revive
 * an entry whose `ttlMs` elapsed without a heartbeat (for example after the process
 * was suspended), so it must republish even when the content is unchanged.
 */
function publishIfChanged(entry: ProviderEntry): void {
  if (publishedEntry && isSameContent(publishedEntry, entry)) {
    const remaining = getRemainingTtlMs(publishedEntry, Date.now());
    if (remaining === undefined || remaining > 0) return;
  }
  ensureRuntime().update(entry);
  publishedEntry = entry;
}

/** Always republishes so `updatedAt` keeps the entry inside its `ttlMs` window. */
function republish(entry: ProviderEntry): void {
  ensureRuntime().update(entry);
  publishedEntry = entry;
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
  const preferredTags = getBlockPreferredTags(getPreset(DEFAULT_PRESET_ID), block);
  const tags = [...new Set([...preferredTags, ...readEventTags()])];

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
  republish(buildDemoProviderEntry(config));
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

  publishIfChanged(buildDemoProviderEntry(config));
  ensureHeartbeat();
}

export function stopDemoProviderHeartbeat(): void {
  if (heartbeat) {
    clearInterval(heartbeat);
    heartbeat = undefined;
  }
  runtime?.stop();
  runtime = undefined;
  publishedEntry = undefined;
}
