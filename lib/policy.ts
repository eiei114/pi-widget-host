import { type HostConfig, type HostTimeBlock, type KnownHostTag, type PolicyEvaluationResult, type PolicyPreset, type ProviderEntry, type ProviderState } from "./types.ts";

export const DEFAULT_PRESET_ID = "always-demo";
export const KNOWN_HOST_TAGS: readonly KnownHostTag[] = ["music", "sports", "playing-now", "matchday", "idle"] as const;

export const PRESET_OPTIONS: readonly PolicyPreset[] = [
  {
    id: DEFAULT_PRESET_ID,
    label: "Always demo",
    description: "Keep the demo provider eligible in every time block.",
    blocks: {
      morning: { preferredTags: ["music", "idle"] },
      day: { preferredTags: ["sports", "idle"] },
      evening: { preferredTags: ["music", "sports"] },
      night: { preferredTags: ["idle", "music"] },
    },
  },
  {
    id: "focus-day",
    label: "Focus day",
    description: "Show the shared slot during morning, day, and evening. Stay silent at night.",
    blocks: {
      morning: { preferredTags: ["music", "idle"] },
      day: { preferredTags: ["sports", "idle"] },
      evening: { preferredTags: ["music", "sports"] },
      night: { allowedProviderIds: [] },
    },
  },
  {
    id: "night-owl",
    label: "Night owl",
    description: "Stay quiet during work hours and show the shared slot in evening and night.",
    blocks: {
      morning: { allowedProviderIds: [] },
      day: { allowedProviderIds: [] },
      evening: { preferredTags: ["music", "sports"] },
      night: { preferredTags: ["idle", "music"] },
    },
  },
];

export function getPreset(id: string | undefined): PolicyPreset {
  return PRESET_OPTIONS.find((preset) => preset.id === id) ?? PRESET_OPTIONS[0]!;
}

export function detectTimeBlock(now = new Date()): HostTimeBlock {
  const hour = now.getHours();
  if (hour >= 5 && hour < 11) return "morning";
  if (hour >= 11 && hour < 17) return "day";
  if (hour >= 17 && hour < 22) return "evening";
  return "night";
}

export function getRemainingTtlMs(entry: Pick<ProviderEntry, "updatedAt" | "ttlMs">, nowMs = Date.now()): number | undefined {
  if (typeof entry.ttlMs !== "number" || entry.ttlMs <= 0) return undefined;
  const updatedAtMs = Date.parse(entry.updatedAt);
  if (!Number.isFinite(updatedAtMs)) return undefined;
  return updatedAtMs + entry.ttlMs - nowMs;
}

export function isEntryStale(entry: Pick<ProviderEntry, "updatedAt" | "ttlMs">, now = new Date()): boolean {
  const remaining = getRemainingTtlMs(entry, now.getTime());
  return typeof remaining === "number" ? remaining <= 0 : false;
}

function tagScore(knownTags: KnownHostTag[], preferredTags: readonly KnownHostTag[] | undefined): number {
  if (!preferredTags || preferredTags.length === 0) return 0;
  const scores = preferredTags
    .map((tag, index) => (knownTags.includes(tag) ? Math.max(40 - index * 10, 10) : 0))
    .filter((value) => value > 0);
  return scores.length > 0 ? Math.max(...scores) : 0;
}

function eventBoost(knownTags: KnownHostTag[]): number {
  let boost = 0;
  if (knownTags.includes("playing-now")) boost += 100;
  if (knownTags.includes("matchday")) boost += 80;
  return boost;
}

function normalizeKnownTags(tags: string[] | undefined): KnownHostTag[] {
  const known = new Set<KnownHostTag>();
  for (const tag of tags ?? []) {
    if ((KNOWN_HOST_TAGS as readonly string[]).includes(tag)) {
      known.add(tag as KnownHostTag);
    }
  }
  return [...known];
}

export function describePreset(preset: PolicyPreset): string {
  const lines = [`Preset: ${preset.label}`, preset.description, "Blocks:"];
  for (const block of ["morning", "day", "evening", "night"] as const) {
    const policy = preset.blocks[block];
    const allowed = policy.allowedProviderIds && policy.allowedProviderIds.length > 0 ? policy.allowedProviderIds.join(", ") : "silent";
    const tags = policy.preferredTags && policy.preferredTags.length > 0 ? policy.preferredTags.join(", ") : "none";
    lines.push(`- ${block}: allowed=${allowed}; preferred tags=${tags}`);
  }
  return lines.join("\n");
}

export function evaluateProviderEntries(entries: readonly ProviderEntry[], config: HostConfig, now = new Date()): PolicyEvaluationResult {
  const preset = getPreset(config.presetId);
  const timeBlock = detectTimeBlock(now);
  const blockPolicy = preset.blocks[timeBlock];

  const providerStates = entries.map<ProviderState>((entry) => {
    const knownTags = normalizeKnownTags(entry.tags);
    const isMuted = config.mutedProviderIds.includes(entry.providerId);
    const isStale = isEntryStale(entry, now);
    const hasLines = Array.isArray(entry.lines) && entry.lines.length > 0;
    const isAllowed = blockPolicy.allowedProviderIds === undefined || blockPolicy.allowedProviderIds.includes(entry.providerId);
    const reasons: string[] = [];

    if (!entry.available) reasons.push("provider reported unavailable");
    if (!hasLines) reasons.push("no render lines");
    if (!isAllowed) reasons.push("blocked by current preset");
    if (isMuted) reasons.push("muted in host config");
    if (isStale) reasons.push("stale ttl");

    const effectivePriority = (entry.priority ?? 0) + tagScore(knownTags, blockPolicy.preferredTags) + eventBoost(knownTags);

    let effectiveStatus: ProviderState["effectiveStatus"] = "eligible";
    if (isMuted) {
      effectiveStatus = "muted";
    } else if (isStale) {
      effectiveStatus = "stale";
    } else if (!entry.available || !hasLines || !isAllowed) {
      effectiveStatus = "unavailable";
    }

    return {
      ...entry,
      effectivePriority,
      effectiveStatus,
      knownTags,
      reasons,
      isMuted,
      isStale,
    };
  });

  const winner = providerStates
    .filter((state) => state.effectiveStatus === "eligible")
    .sort((left, right) => right.effectivePriority - left.effectivePriority || left.providerId.localeCompare(right.providerId))[0];

  if (winner) {
    winner.effectiveStatus = "active";
  }

  return {
    timeBlock,
    preset,
    providerStates,
    activeProvider: winner,
  };
}
