# Roadmap

This is the living maintenance roadmap for [`pi-widget-host`](https://github.com/eiei114/pi-widget-host) — the shared-slot host package that owns one prompt-top Pi widget and picks a single winning provider from a `globalThis` registry.

It exists so the weekly maintenance seed planner (and any human contributor) can see current release status at a glance and pick the next bounded 30–90 minute micro-task without re-discovering context.

> Scope: this file is repository-level maintenance context. It is **not** shipped in the npm tarball (see `package.json` `files`), so changes here do not require a version bump or publish.

---

## 1. Current release status

| Item | Value |
|---|---|
| Package | `pi-widget-host` |
| Published version (npm `latest`) | `0.3.3` |
| `package.json` version | `0.3.3` |
| Latest GitHub release | [`v0.3.3`](https://github.com/eiei114/pi-widget-host/releases/tag/v0.3.3) — 2026-07-04 |
| Runtime dependency | `pi-widget-core` `^0.1.0` (npm latest `0.1.2`) |
| Release mechanism | npm Trusted Publishing via `.github/workflows/auto-release.yml` + `publish.yml` |

### Release line so far

| Version | Date | Theme |
|---|---|---|
| `0.2.0` | 2026-06-15 | First shared-slot host MVP: host config, registry protocol, demo provider, preset policy. |
| `0.3.0` | 2026-06-24 | Host-only MVP complete: event boost (`playing-now`, `matchday`), known host tags, registry protocol v1, demo-provider dogfooding. |
| `0.3.1` | 2026-06-25 | README / package-contents alignment with Pi OSS template baseline. |
| `0.3.2` | 2026-06-26 | npm Trusted Publishing publish retry (no functional change). |
| `0.3.3` | 2026-07-04 | Sponsor button + native GitHub funding link. |

### Milestone state

- **Host-only MVP — done.** One shared slot, preset-first time-block policy, registry protocol v1, built-in demo provider, silent empty slot. This is the supported surface today.
- **Multi-provider reality — not yet proven.** The registry protocol is the headline abstraction, but only the built-in demo provider publishes through it. No second provider package has validated the protocol end-to-end yet.

---

## 2. Priorities

In priority order:

1. **Keep the `0.3.x` line green and dependency-current.** Dependabot hygiene, CHANGELOG sync, and `npm run ci` must stay clean on `main`.
2. **Prove the registry protocol with a real second provider.** This is the biggest open risk: the core abstraction has exactly one user (the demo provider). A minimal external provider de-risks v1 before any v2 work.
3. **Harden the host lifecycle before adding features.** The refresh / stale-TTL timer / registry-subscribe paths in `extensions/index.ts` are under-tested; lock them down before layering new policy UX on top.

Non-goals for this cycle: a v2 registry protocol, a UI settings screen, automated provider discovery beyond `globalThis`.

---

## 3. Short-term maintenance goals (next 2–3 releases)

### `0.3.4` (patch) — dependency & docs hygiene

Goal: clear the pending dependency backlog and get the docs to a clean baseline.

- Land the open Dependabot bumps (`pi-widget-core` → `0.1.2`, dev-deps group) behind a green `npm run ci`.
- Sync `CHANGELOG.md` with the already-shipped `0.3.3` (sponsor entry is still under `## Unreleased`).
- Add a provider-protocol example and a docs index so the registry story is discoverable.

### `0.4.0` (minor) — first provider-package pilot

Goal: validate the registry protocol end-to-end with one external provider package (in-repo example or a companion package), and raise test coverage of the host refresh/timer paths. A minor bump because the pilot may surface protocol clarifications that are user-visible to provider authors.

### `0.5.0` (minor, tentative) — policy & provider UX

Goal: broaden the policy surface once the foundations are proven — additional presets, timezone-aware time blocks, and a `/widget-host:diagnostics` command surfaced from the provider states already computed by `evaluateProviderEntries`.

> Release/publish, secrets, and billing remain human-owned. Agent work stops at `npm run ci` green + an open PR; a human cuts the version and pushes the tag.

---

## 4. Known technical debt & cleanup

Each item is a candidate 30–90 minute micro-seed (see §5).

- **CHANGELOG is out of sync.** `0.3.3` shipped the sponsor button, but `CHANGELOG.md` still lists it under `## Unreleased` and has no `## [0.3.3]` section.
- **`pi-widget-core` floor is behind.** `package.json` pins `^0.1.0` while npm latest is `0.1.2` (Dependabot PR #19 open).
- **Extension lifecycle is under-tested.** `tests/extension.test.ts` only asserts command registration. The `refreshHostWidget` stale-TTL reschedule timer and the registry `subscribe` re-render path have no direct coverage.
- **No provider example.** `docs/protocol.md` specifies the registry shape but there is no minimal third-party provider snippet for new authors to copy.
- **No config schema/migration story.** `HostConfig.schemaVersion` is pinned to `1` with normalization in `lib/config.ts`, but the field contract, defaults, and forward-migration expectation are undocumented.
- **No lint/format policy.** No ESLint / Prettier / Biome config; `npm run ci` runs `tsc` + `node:test` + `npm pack --dry-run` only. The choice is fine, but it is currently implicit.
- **Time blocks are local-TZ only.** `detectTimeBlock` reads the host's local hour with no timezone override; this limitation is undocumented.

---

## 5. Candidate maintenance seeds

Each seed is intentionally bounded to **30–90 minutes** and ships behind a green `npm run ci`. Pick one per maintenance window. Seeds are candidates, not commitments — promote a seed to a tracked issue when you start it.

> How to run the gate locally: `npm install && npm run ci` (typecheck + tests + `npm pack --dry-run`).

### Seed 1 — Sync CHANGELOG with shipped `0.3.3`  ·  ~30 min

Promote the sponsor entry out of `## Unreleased` into a real release section.

- **Acceptance**
  - `CHANGELOG.md` has a `## [0.3.3] - 2026-07-04` section under `### Added` describing the Buy Me a Coffee button + `.github/FUNDING.yml` link.
  - `## Unreleased` is empty (placeholder line only) or removed until the next real change.
  - The `0.3.3` date matches `gh release view v0.3.3 --json publishedAt`.
  - `npm run ci` is green; no `package.json` version change (already `0.3.3`).

### Seed 2 — Add a minimal provider example  ·  ~60–90 min

Give provider authors a copy-paste starting point.

- **Acceptance**
  - A new `docs/provider-example.md` (or `examples/` snippet) shows a ~15-line provider publishing through the registry using `Symbol.for("pi-widget-host.registry.v1")`.
  - It demonstrates the required fields (`providerId`, `available`, `lines`, `updatedAt`) and at least one optional field (`priority` or `tags`).
  - `README.md` "Registry protocol" section links to it.
  - `npm run ci` is green.

### Seed 3 — Document the config schema & normalization contract  ·  ~60 min

Make `HostConfig` self-describing.

- **Acceptance**
  - A new `docs/config.md` (or a "Config schema" subsection) lists every `HostConfig` field, its default, and what `normalizeConfig` coerces.
  - A new test in `tests/config.test.ts` asserts `readHostConfig` on malformed input (non-array `mutedProviderIds`, bogus `presetId`, non-object payload) returns the default config shape.
  - `npm run ci` is green.

### Seed 4 — Cover the stale-TTL & registry-subscribe refresh paths  ·  ~60–90 min

Lift `extensions/index.ts` test coverage beyond command registration.

- **Acceptance**
  - New test(s) in `tests/extension.test.ts` (or a new `tests/host-refresh.test.ts`) assert that `refreshHostWidget` schedules a stale-TTL re-evaluation, and that a registry `subscribe` callback triggers a refresh.
  - Tests use fake timers / injected `now` and do not depend on wall-clock timing.
  - `npm run ci` is green.

### Seed 5 — Document the local-timezone time-block limitation  ·  ~30–45 min

Stop the silent surprise.

- **Acceptance**
  - A "Limitations" / FAQ entry (in `docs/protocol.md` or a new `docs/faq.md`) explains that `detectTimeBlock` uses the host's local hour with no TZ override.
  - `README.md` or the docs index links to it.
  - `npm run ci` is green.

### Seed 6 — Add a docs index  ·  ~30 min

One-click discovery.

- **Acceptance**
  - A new `docs/README.md` links `protocol.md`, `release.md`, `../ROADMAP.md`, and any docs added by other seeds.
  - `README.md` "Package contents" or "Links" references `docs/README.md`.
  - `npm run ci` is green.

### Seed 7 — Record the lint/format policy decision  ·  ~45–60 min

Make the implicit explicit.

- **Acceptance**
  - Either a short decision note in `CONTRIBUTING.md` (or a `docs/decisions/` ADR) stating the current "tsc + `node:test` + `npm pack --dry-run` only" policy and when it would change, **or** a minimal Biome/ESLint config plus an `npm run lint` script wired into `npm run ci`.
  - `npm run ci` is green.

---

## 6. Conventions for updating this roadmap

- Update §1 whenever a version ships or a dependency floor moves.
- Promote a §5 seed to "in progress" by opening a tracking issue; move finished seeds to the relevant release line in §3.
- Keep each seed bounded to 30–90 minutes with explicit acceptance criteria — if a seed grows past that, split it.
- This file does not ship in the npm package, so roadmap edits never require a version bump or publish on their own.
