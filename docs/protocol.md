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

## Limitations

### Time blocks use the host's local timezone

Policy evaluation calls `detectTimeBlock(now)` in `lib/policy.ts`, which reads `now.getHours()` — the **host machine's local hour** in the process timezone. There is no `HostConfig` field or environment variable to override the timezone or shift block boundaries.

Block boundaries (local hour, inclusive start / exclusive end unless noted):

| Block | Local hour range |
|---|---|
| `morning` | 05:00–10:59 |
| `day` | 11:00–16:59 |
| `evening` | 17:00–21:59 |
| `night` | 22:00–04:59 |

Because presets are keyed by these blocks, the same `presetId` can behave differently on machines in different timezones or when the OS timezone changes. For example:

- **`focus-day`** keeps the shared slot active during `morning`, `day`, and `evening`, but stays **silent at `night`**. A provider that looks "blocked" at 23:00 UTC may still be eligible at 23:00 JST on a Tokyo-local host.
- **`night-owl`** stays **silent during `morning` and `day`**, then allows the slot in `evening` and `night`. Travel or remote machines can flip eligibility without any config change.

When debugging provider priority or preset behavior, check the host's local time and current block before assuming a config bug.
