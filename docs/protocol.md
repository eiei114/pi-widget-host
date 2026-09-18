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

### Scheduling examples (local hour assumptions)

The examples below mirror `tests/time-block-policy.test.ts`. Each `Date` is constructed with the host's **local** calendar fields (`new Date(year, month, day, hour, …)`), so the resulting time block follows the machine timezone, not UTC.

**Example 1 — `night-owl` stays silent during work hours**

With `presetId: "night-owl"` and one eligible demo provider:

| Local time on host | `detectTimeBlock` | Widget slot |
|---|---|---|
| 07:00 | `morning` | silent |
| 13:00 | `day` | silent |
| 19:00 | `evening` | active |
| 23:00 | `night` | active |

The same saved preset can look "broken" when you compare against UTC. At **23:00 UTC** on a UTC host the block is `night` and the slot is active; on a **Tokyo-local host** that instant is **08:00 JST** (`morning`), so `night-owl` correctly stays silent.

**Example 2 — `focus-day` vs `always-demo` at local night**

At **23:30 local** with one eligible provider:

- `always-demo` — slot stays active (`night` block is allowed).
- `focus-day` — slot is silent (`night` block sets `allowedProviderIds: []`).

**Example 3 — TTL refresh scheduling is UTC-based**

Stale exclusion and the host's stale-TTL `setTimeout` use `updatedAt` (ISO-8601 UTC) plus `ttlMs`. That path does **not** read local hour boundaries:

```ts
registry.set({
  providerId: "example.stale-check",
  available: true,
  lines: ["hello"],
  updatedAt: new Date().toISOString(), // UTC instant
  ttlMs: 90_000,
});
```

A provider published at `2026-06-15T12:00:00.000Z` with `ttlMs: 60_000` goes stale at `12:01:00Z` on every host, regardless of preset or local time block. Do not mix this TTL clock with preset time-block scheduling when debugging.
