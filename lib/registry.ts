import { REGISTRY_SYMBOL, type ProviderEntry } from "./types.ts";

type Listener = () => void;

export interface WidgetHostRegistry {
  version: 1;
  set: (entry: ProviderEntry) => void;
  remove: (providerId: string) => void;
  list: () => ProviderEntry[];
  subscribe: (listener: Listener) => () => void;
  clear: () => void;
}

function normalizeEntry(entry: ProviderEntry): ProviderEntry {
  return {
    providerId: entry.providerId.trim(),
    available: entry.available === true,
    lines: Array.isArray(entry.lines) ? entry.lines.map((line) => String(line)) : [],
    updatedAt: new Date(entry.updatedAt).toISOString(),
    priority: typeof entry.priority === "number" ? entry.priority : 0,
    tags: Array.isArray(entry.tags) ? [...new Set(entry.tags.map((tag) => String(tag).trim()).filter(Boolean))] : [],
    mode: typeof entry.mode === "string" && entry.mode.trim().length > 0 ? entry.mode.trim() : undefined,
    ttlMs: typeof entry.ttlMs === "number" && entry.ttlMs > 0 ? entry.ttlMs : undefined,
  };
}

function sameEntry(left: ProviderEntry | undefined, right: ProviderEntry): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function createRegistry(): WidgetHostRegistry {
  const entries = new Map<string, ProviderEntry>();
  const listeners = new Set<Listener>();
  const notify = () => {
    for (const listener of listeners) {
      listener();
    }
  };

  return {
    version: 1,
    set(entry) {
      const normalized = normalizeEntry(entry);
      const previous = entries.get(normalized.providerId);
      if (sameEntry(previous, normalized)) return;
      entries.set(normalized.providerId, normalized);
      notify();
    },
    remove(providerId) {
      if (!entries.delete(providerId)) return;
      notify();
    },
    list() {
      return [...entries.values()].map((entry) => ({ ...entry, lines: [...entry.lines], tags: [...(entry.tags ?? [])] }));
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    clear() {
      if (entries.size === 0) return;
      entries.clear();
      notify();
    },
  };
}

export function getWidgetHostRegistry(): WidgetHostRegistry {
  const root = globalThis as typeof globalThis & Record<symbol, WidgetHostRegistry | undefined>;
  const existing = root[REGISTRY_SYMBOL];
  if (existing) return existing;
  const registry = createRegistry();
  root[REGISTRY_SYMBOL] = registry;
  return registry;
}

export function publishProviderEntry(entry: ProviderEntry): void {
  getWidgetHostRegistry().set(entry);
}

export function removeProviderEntry(providerId: string): void {
  getWidgetHostRegistry().remove(providerId);
}

export function listProviderEntries(): ProviderEntry[] {
  return getWidgetHostRegistry().list();
}
