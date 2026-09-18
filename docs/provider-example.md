# Minimal provider example

Provider packages can publish widget lines without importing `pi-widget-host`. They only need to write a `ProviderEntry` into the process-local registry on `globalThis`.

```ts
const registrySymbol = Symbol.for("pi-widget-host.registry.v1");

type ProviderEntry = {
  providerId: string;
  available: boolean;
  lines: string[];
  updatedAt: string;
  priority?: number;
  tags?: string[];
  mode?: string;
  ttlMs?: number;
};

type WidgetHostRegistry = {
  set(entry: ProviderEntry): void;
};

const registry = Reflect.get(globalThis, registrySymbol) as WidgetHostRegistry | undefined;

registry?.set({
  providerId: "example.now-playing",
  available: true,
  lines: ["Now Playing", "Example Artist — Example Song"],
  updatedAt: new Date().toISOString(),
  priority: 20,
  tags: ["music", "playing-now"],
});
```

Required fields are `providerId`, `available`, `lines`, and `updatedAt`. Optional fields such as `priority`, `tags`, `mode`, and `ttlMs` help the host choose between eligible providers. See [`protocol.md`](protocol.md) for the full registry shape and host selection notes.

## Timezone assumptions

Two different clocks appear in this example:

| Field / mechanism | Time basis | Used for |
|---|---|---|
| `updatedAt` (`toISOString()`) | UTC instant | stale exclusion and stale-TTL refresh scheduling |
| Preset time blocks (`morning`, `day`, …) | Host machine local hour | when a saved preset allows or silences the shared slot |

`new Date().toISOString()` in the snippet above is correct for TTL bookkeeping. It does **not** pin the provider to a local time block — the host evaluates blocks separately via `detectTimeBlock(now)` when applying preset policy.

Tags cannot gate availability: the host scores `tags` only against the current block's `preferredTags` (plus the `playing-now` / `matchday` event boost) to adjust `effectivePriority`. Eligibility still depends on registry state (`available`, `lines`, stale TTL, host mutes) and the preset's `allowedProviderIds`. If your provider must appear only during certain local hours, enforce that in your own publish loop; the host will still classify the current block from the **process local timezone**. See [Limitations — scheduling examples](protocol.md#scheduling-examples-local-hour-assumptions) for preset walkthroughs (`focus-day`, `night-owl`) and a UTC-vs-local debugging scenario.
