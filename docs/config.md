# Host config schema and normalization

`pi-widget-host` persists host settings in a JSON file under the Pi agent directory. Every read and write path runs the payload through `normalizeConfig` in `lib/config.ts` so callers always receive a stable `HostConfig` shape.

## Storage location

| Item | Value |
|---|---|
| Default path | `~/.pi/agent/pi-widget-host-config.json` |
| Override | Set `PI_WIDGET_HOST_AGENT_DIR` to use `<dir>/pi-widget-host-config.json` instead |

If the file is missing, unreadable, or contains invalid JSON, `readHostConfig()` returns `createDefaultConfig()` without throwing.

## `HostConfig` fields

All fields are required on the normalized object. Unknown keys in stored JSON are ignored.

| Field | Type | Default | `normalizeConfig` coercion |
|---|---|---|---|
| `schemaVersion` | `1` (literal) | `1` | Always rewritten to `1`. Any stored value is replaced. |
| `setupComplete` | `boolean` | `false` | `true` only when the input value is strictly `true`; every other value becomes `false`. |
| `demoProviderEnabled` | `boolean` | `false` | `true` only when the input value is strictly `true`; every other value becomes `false`. |
| `presetId` | `string` | `"always-demo"` | When the input is a string that matches a built-in preset id, that id is kept. Otherwise `getPreset()` falls back to the default preset (`"always-demo"`). |
| `mutedProviderIds` | `string[]` | `[]` | When the input is an array, non-empty trimmed strings are kept, duplicates removed, order preserved. Any non-array input becomes `[]`. |

Built-in preset ids (from `lib/policy.ts`):

- `always-demo` (default)
- `focus-day`
- `night-owl`

## Normalization entry points

| Function | Behavior |
|---|---|
| `createDefaultConfig()` | Returns a fresh default object without touching disk. |
| `readHostConfig()` | Reads JSON from disk, parses it, then normalizes. On any I/O or parse failure, returns `createDefaultConfig()`. |
| `writeHostConfig(config)` | Normalizes the input, writes pretty-printed JSON, returns the normalized value. |
| `updateHostConfig(mutator)` | Reads current config, applies `mutator`, then writes through `writeHostConfig`. |

## Non-object and partial payloads

When the parsed JSON root is not a plain object (`null`, array, string, number, boolean), normalization treats the payload as `{}` and produces the full default config shape.

Examples:

```json
"hello"
```

```json
42
```

Both normalize to:

```json
{
  "schemaVersion": 1,
  "setupComplete": false,
  "demoProviderEnabled": false,
  "presetId": "always-demo",
  "mutedProviderIds": []
}
```

Partial objects keep valid fields and coerce the rest:

```json
{
  "setupComplete": true,
  "presetId": "focus-day",
  "mutedProviderIds": ["alpha", "alpha", " "]
}
```

Normalizes to:

```json
{
  "schemaVersion": 1,
  "setupComplete": true,
  "demoProviderEnabled": false,
  "presetId": "focus-day",
  "mutedProviderIds": ["alpha"]
}
```

## Malformed field examples

| Stored value | Normalized result |
|---|---|
| `"presetId": "not-a-real-preset"` | `"presetId": "always-demo"` |
| `"mutedProviderIds": "alpha"` | `"mutedProviderIds": []` |
| `"mutedProviderIds": ["ok", 42, "", "  ", "ok"]` | `"mutedProviderIds": ["ok"]` |
| `"setupComplete": "yes"` | `"setupComplete": false` |
| `"demoProviderEnabled": 1` | `"demoProviderEnabled": false` |

## Schema versioning

`schemaVersion` is pinned to `1`. There is no forward migration path yet; future versions would extend `normalizeConfig` to upgrade older shapes before returning `HostConfig`.

## Related code

- Type definition: `lib/types.ts` (`HostConfig`)
- Normalization and persistence: `lib/config.ts`
- Preset catalog: `lib/policy.ts` (`PRESET_OPTIONS`, `getPreset`, `DEFAULT_PRESET_ID`)
- Tests: `tests/config.test.ts`
