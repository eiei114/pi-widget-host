# Minimal provider example

Provider packages can publish widget lines without importing `pi-widget-host`. They only need to write a `ProviderEntry` into the process-local registry on `globalThis`.

```ts
const registrySymbol = Symbol.for("pi-widget-host.registry.v1");

const registry = globalThis[registrySymbol] as
  | {
      set(entry: {
        providerId: string;
        available: boolean;
        lines: string[];
        updatedAt: string;
        priority?: number;
        tags?: string[];
      }): void;
    }
  | undefined;

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
