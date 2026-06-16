import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { readHostConfig, updateHostConfig, writeHostConfig } from "../lib/config.ts";
import { stopDemoProviderHeartbeat, syncBuiltInDemoProvider } from "../lib/demo-provider.ts";
import { DEFAULT_PRESET_ID, describePreset, evaluateProviderEntries, getPreset, getRemainingTtlMs, PRESET_OPTIONS } from "../lib/policy.ts";
import { clearHostPresent, getWidgetHostRegistry, listProviderEntries, markHostPresent, removeProviderEntry } from "../lib/registry.ts";
import { DEMO_PROVIDER_ID, WIDGET_ID, type HostConfig, type PolicyEvaluationResult, type ProviderState } from "../lib/types.ts";

type NotifyLevel = "info" | "warning" | "error";

interface HostUiBridge {
  setWidget: (id: string, lines: string[] | undefined) => void;
  notify: (message: string, level: NotifyLevel) => void;
  setStatus: (key: string, value: string | undefined) => void;
  select: (prompt: string, options: string[]) => Promise<string | undefined>;
}

let uiBridge: HostUiBridge | undefined;
let registryDispose: (() => void) | undefined;
let staleTimer: NodeJS.Timeout | undefined;

function bindUi(ctx: { hasUI: boolean; ui: HostUiBridge }): void {
  if (!ctx.hasUI) return;
  uiBridge = ctx.ui;
}

function clearStaleTimer(): void {
  if (!staleTimer) return;
  clearTimeout(staleTimer);
  staleTimer = undefined;
}

function summarizeProvider(state: ProviderState): string {
  const tags = state.knownTags.length > 0 ? state.knownTags.join(",") : "none";
  const detail = state.reasons.length > 0 ? ` | ${state.reasons.join("; ")}` : "";
  return `${state.providerId} [${state.effectiveStatus}] prio=${state.effectivePriority} tags=${tags}${detail}`;
}

function summarizeStatus(config: HostConfig, result: PolicyEvaluationResult): string {
  const active = result.activeProvider?.providerId ?? "none";
  return [
    `Setup: ${config.setupComplete ? "done" : "not yet"}`,
    `Preset: ${result.preset.label} (${result.timeBlock})`,
    `Demo provider: ${config.demoProviderEnabled ? "enabled" : "disabled"}`,
    `Active provider: ${active}`,
  ].join("\n");
}

function summarizeProviders(result: PolicyEvaluationResult): string {
  if (result.providerStates.length === 0) {
    return `Providers (${result.timeBlock}): none registered`;
  }

  return [`Providers (${result.timeBlock}):`, ...result.providerStates.map((state) => `- ${summarizeProvider(state)}`)].join("\n");
}

async function refreshHostWidget(ctx?: { hasUI: boolean; ui: HostUiBridge }): Promise<{ config: HostConfig; result: PolicyEvaluationResult }> {
  if (ctx) bindUi(ctx);

  const config = await readHostConfig();
  await syncBuiltInDemoProvider(config);

  const result = evaluateProviderEntries(listProviderEntries(), config, new Date());
  uiBridge?.setWidget(WIDGET_ID, result.activeProvider?.lines);
  uiBridge?.setStatus("widget-host", `${result.preset.label} | active: ${result.activeProvider?.providerId ?? "none"}`);

  clearStaleTimer();
  const nextTtlMs = result.providerStates
    .map((state) => getRemainingTtlMs(state, Date.now()))
    .filter((value): value is number => typeof value === "number" && value > 0)
    .sort((a, b) => a - b)[0];

  if (typeof nextTtlMs === "number") {
    staleTimer = setTimeout(() => {
      void refreshHostWidget().catch(() => undefined);
    }, Math.max(nextTtlMs + 25, 25));
  }

  return { config, result };
}

function ensureRegistryWatcher(): void {
  if (registryDispose) return;
  registryDispose = getWidgetHostRegistry().subscribe(() => {
    void refreshHostWidget().catch(() => undefined);
  });
}

async function selectPreset(ctx: { ui: Pick<HostUiBridge, "select"> }, prompt: string): Promise<string | undefined> {
  const labels = PRESET_OPTIONS.map((preset) => `${preset.label} — ${preset.description}`);
  const picked = await ctx.ui.select(prompt, labels);
  if (!picked) return undefined;
  const index = labels.indexOf(picked);
  return index >= 0 ? PRESET_OPTIONS[index]?.id : undefined;
}

function ensureInteractive(ctx: { hasUI: boolean }): boolean {
  if (ctx.hasUI) return true;
  uiBridge?.notify("widget-host commands need Pi UI mode.", "warning");
  return false;
}

export default function widgetHostExtension(pi: ExtensionAPI) {
  pi.on("session_start", async (_event, ctx) => {
    if (!ctx.hasUI) return;
    bindUi(ctx as { hasUI: boolean; ui: HostUiBridge });
    markHostPresent();
    ensureRegistryWatcher();
    await refreshHostWidget(ctx as { hasUI: boolean; ui: HostUiBridge });
  });

  pi.on("session_shutdown", async () => {
    clearStaleTimer();
    registryDispose?.();
    registryDispose = undefined;
    stopDemoProviderHeartbeat();
    removeProviderEntry(DEMO_PROVIDER_ID);
    clearHostPresent();
    uiBridge = undefined;
  });

  pi.registerCommand("widget-host:setup", {
    description: "Configure pi-widget-host and optionally enable the built-in demo provider.",
    handler: async (_args, ctx) => {
      if (!ensureInteractive(ctx)) return;
      bindUi(ctx as { hasUI: boolean; ui: HostUiBridge });
      ensureRegistryWatcher();

      const current = await readHostConfig();
      const demoChoice = await ctx.ui.select("widget-host setup | built-in demo provider", [
        "Enable demo provider",
        "Keep host silent",
      ]);
      if (!demoChoice) return;

      const presetId = await selectPreset(ctx as { ui: Pick<HostUiBridge, "select"> }, "widget-host setup | choose a preset");
      if (!presetId) return;

      const next = await writeHostConfig({
        ...current,
        setupComplete: true,
        demoProviderEnabled: demoChoice === "Enable demo provider",
        presetId,
      });

      await syncBuiltInDemoProvider(next);
      const { result } = await refreshHostWidget(ctx as { hasUI: boolean; ui: HostUiBridge });
      ctx.ui.notify(`Saved setup. ${summarizeStatus(next, result)}`, "info");
    },
  });

  pi.registerCommand("widget-host:status", {
    description: "Show current host setup, preset, and active provider state.",
    handler: async (_args, ctx) => {
      bindUi(ctx as { hasUI: boolean; ui: HostUiBridge });
      ensureRegistryWatcher();
      const { config, result } = await refreshHostWidget(ctx as { hasUI: boolean; ui: HostUiBridge });
      if (ctx.hasUI) {
        ctx.ui.notify(summarizeStatus(config, result), "info");
      }
    },
  });

  pi.registerCommand("widget-host:policy", {
    description: "Inspect or change the saved preset-first host policy.",
    handler: async (_args, ctx) => {
      if (!ensureInteractive(ctx)) return;
      bindUi(ctx as { hasUI: boolean; ui: HostUiBridge });
      ensureRegistryWatcher();

      const current = await readHostConfig();
      const currentPreset = getPreset(current.presetId || DEFAULT_PRESET_ID);
      const action = await ctx.ui.select(`widget-host policy | current: ${currentPreset.label}`, ["Show policy", "Change preset"]);
      if (!action) return;

      if (action === "Show policy") {
        ctx.ui.notify(describePreset(currentPreset), "info");
        return;
      }

      const presetId = await selectPreset(ctx as { ui: Pick<HostUiBridge, "select"> }, "widget-host policy | choose a preset");
      if (!presetId) return;

      const next = await updateHostConfig((config) => ({
        ...config,
        setupComplete: true,
        presetId,
      }));

      const { result } = await refreshHostWidget(ctx as { hasUI: boolean; ui: HostUiBridge });
      ctx.ui.notify(`Policy saved: ${getPreset(next.presetId).label}. Active provider: ${result.activeProvider?.providerId ?? "none"}`, "info");
    },
  });

  pi.registerCommand("widget-host:providers", {
    description: "List known providers and their effective host state.",
    handler: async (_args, ctx) => {
      bindUi(ctx as { hasUI: boolean; ui: HostUiBridge });
      ensureRegistryWatcher();
      const { result } = await refreshHostWidget(ctx as { hasUI: boolean; ui: HostUiBridge });
      if (ctx.hasUI) {
        ctx.ui.notify(summarizeProviders(result), "info");
      }
    },
  });

  pi.registerCommand("widget-host:mute", {
    description: "Mute one registered provider in the global host config.",
    handler: async (_args, ctx) => {
      if (!ensureInteractive(ctx)) return;
      bindUi(ctx as { hasUI: boolean; ui: HostUiBridge });
      ensureRegistryWatcher();

      const { result } = await refreshHostWidget(ctx as { hasUI: boolean; ui: HostUiBridge });
      const candidates = result.providerStates.filter((state) => !state.isMuted).map((state) => `${state.providerId} — ${state.effectiveStatus}`);
      if (candidates.length === 0) {
        ctx.ui.notify("No unmuted providers available.", "warning");
        return;
      }

      const picked = await ctx.ui.select("widget-host mute | choose provider", candidates);
      if (!picked) return;
      const providerId = picked.split(" — ")[0]?.trim();
      if (!providerId) return;

      await updateHostConfig((config) => ({
        ...config,
        mutedProviderIds: [...new Set([...config.mutedProviderIds, providerId])],
      }));

      const { result: next } = await refreshHostWidget(ctx as { hasUI: boolean; ui: HostUiBridge });
      ctx.ui.notify(`Muted ${providerId}. Active provider: ${next.activeProvider?.providerId ?? "none"}`, "info");
    },
  });

  pi.registerCommand("widget-host:unmute", {
    description: "Unmute one provider in the global host config.",
    handler: async (_args, ctx) => {
      if (!ensureInteractive(ctx)) return;
      bindUi(ctx as { hasUI: boolean; ui: HostUiBridge });
      ensureRegistryWatcher();

      const { config } = await refreshHostWidget(ctx as { hasUI: boolean; ui: HostUiBridge });
      if (config.mutedProviderIds.length === 0) {
        ctx.ui.notify("No muted providers stored in config.", "warning");
        return;
      }

      const providerId = await ctx.ui.select("widget-host unmute | choose provider", config.mutedProviderIds);
      if (!providerId) return;

      await updateHostConfig((nextConfig) => ({
        ...nextConfig,
        mutedProviderIds: nextConfig.mutedProviderIds.filter((id) => id !== providerId),
      }));

      const { result } = await refreshHostWidget(ctx as { hasUI: boolean; ui: HostUiBridge });
      ctx.ui.notify(`Unmuted ${providerId}. Active provider: ${result.activeProvider?.providerId ?? "none"}`, "info");
    },
  });
}
