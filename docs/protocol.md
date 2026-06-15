# Registry protocol

`pi-widget-host` exposes a process-local provider registry on `globalThis`.

## Symbol

```ts
Symbol.for("pi-widget-host.registry.v1")
```

## Registry shape

```ts
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
  version: 1;
  set(entry: ProviderEntry): void;
  remove(providerId: string): void;
  list(): ProviderEntry[];
  subscribe(listener: () => void): () => void;
};
```

## Required fields

- `providerId`
- `available`
- `lines`
- `updatedAt`

## Optional fields

- `priority`
- `tags`
- `mode`
- `ttlMs`

## Notes

- unknown tags are ignored safely by the host
- `ttlMs` + `updatedAt` drive stale exclusion
- providers render final lines themselves; the host only picks a winner
- the host can mute providers from config without uninstalling the package
