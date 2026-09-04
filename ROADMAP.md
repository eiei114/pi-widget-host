# Roadmap

This is the living maintenance roadmap for [`pi-widget-host`](https://github.com/eiei114/pi-widget-host) — the shared-slot host package that owns one prompt-top Pi widget and picks a single winning provider from a `globalThis` registry.

It exists so the weekly maintenance seed planner (and any human contributor) can see current release status at a glance and pick the next bounded 30–90 minute micro-task without re-discovering context.

> Scope: this file is repository-level maintenance context. It is **not** shipped in the npm tarball (see `package.json` `files`), so changes here do not require a version bump or publish.

---

## 1. Current release status

| Item | Value |
|---|---|
| Package | `pi-widget-host` |
| Published version (npm `latest`) | `0.3.6` |
| `package.json` version | `0.3.6` |
| Latest GitHub release | [`v0.3.6`](https://github.com/eiei114/pi-widget-host/releases/tag/v0.3.6) — 2026-08-22 |
| Runtime dependency | `pi-widget-core` `^0.1.4` (npm latest `0.1.4`) |
| Release mechanism | npm Trusted Publishing via `.github/workflows/auto-release.yml` + `publish.yml` |
| CI gate | `npm run ci` — typecheck + 32 `node:test` cases + `npm pack --dry-run` |

### Release line so far

| Version | Date | Theme |
|---|---|---|
| `0.2.0` | 2026-06-15 | First shared-slot host MVP: host config, registry protocol, demo provider, preset policy. |
| `0.3.0` | 2026-06-24 | Host-only MVP complete: event boost (`playing-now`, `matchday`), known host tags, registry protocol v1, demo-provider dogfooding. |
| `0.3.1` | 2026-06-25 | README / package-contents alignment with Pi OSS template baseline. |
| `0.3.2` | 2026-06-26 | npm Trusted Publishing publish retry (no functional change). |
| `0.3.3` | 2026-07-04 | Sponsor button + native GitHub funding link. |
| `0.3.4` | 2026-07-20 | ROADMAP maintenance context, CONTRIBUTING/release doc alignment, dependency updates. |
| `0.3.5` | 2026-08-04 | Discord community badge and release webhook verification. |
| `0.3.6` | 2026-08-22 | Managed OSS dependency batch; stale-TTL and registry-subscribe refresh test coverage (DOT-1696). |

### Milestone state

- **Host-only MVP — done.** One shared slot, preset-first time-block policy, registry protocol v1, built-in demo provider, silent empty slot. This is the supported surface today.
- **Host lifecycle coverage — improved.** `tests/host-refresh.test.ts` now covers stale-TTL reschedule and registry `subscribe` refresh paths; command registration remains in `tests/extension.test.ts`.
- **Config & docs baseline — done.** `docs/config.md`, `docs/README.md`, and `docs/provider-example.md` are linked from README and validated by `tests/package.test.ts`.
- **Multi-provider reality — not yet proven.** The registry protocol is the headline abstraction, but only the built-in demo provider publishes through it. No second provider package has validated the protocol end-to-end yet.

---

## 2. Priorities

In priority order:

1. **Keep the `0.3.x` line green and dependency-current.** Dependabot hygiene, CHANGELOG sync, and `npm run ci` must stay clean on `main`.
2. **Prove the registry protocol with a real second provider.** This is the biggest open risk: the core abstraction has exactly one user (the demo provider). A minimal external provider de-risks v1 before any v2 work.
3. **Close remaining doc and policy gaps before `0.4.0`.** Local-timezone time-block behavior and the lint/format policy are still implicit; provider authors need both spelled out.
4. **Deepen command-path coverage only where it blocks the pilot.** Refresh/timer paths are covered; next tests should focus on `/widget-host:*` handler behavior if the pilot surfaces gaps.

Non-goals for this cycle: a v2 registry protocol, a UI settings screen, automated provider discovery beyond `globalThis`.

---

## 3. Short-term maintenance goals (next 1–2 releases)

### `0.3.6` (patch) — dependency & lifecycle hardening — shipped

Goal: land the August dependency batch and lock down host refresh paths.

- [x] Sync `CHANGELOG.md` with shipped `0.3.5` and `0.3.6` release sections.
- [x] Align `pi-widget-core` floor with npm latest `0.1.4`.
- [x] Cover stale-TTL reschedule and registry `subscribe` refresh in `tests/host-refresh.test.ts`.
- [x] Keep `docs/provider-example.md` linked from README and ROADMAP.

### `0.4.0` (minor) — first provider-package pilot

Goal: validate the registry protocol end-to-end with one external provider package (in-repo example or a companion package), and close the remaining documentation gaps called out in §5. A minor bump because the pilot may surface protocol clarifications that are user-visible to provider authors.

### `0.5.0` (minor, tentative) — policy & provider UX

Goal: broaden the policy surface once the foundations are proven — additional presets, timezone-aware time blocks, and a `/widget-host:diagnostics` command surfaced from the provider states already computed by `evaluateProviderEntries`.

> Release/publish, secrets, and billing remain human-owned. Agent work stops at `npm run ci` green + an open PR; a human cuts the version and pushes the tag.

---

## 4. Known technical debt & cleanup

Each item is a candidate 30–90 minute micro-seed (see §5).

- **Time blocks are local-TZ only.** `detectTimeBlock` reads the host's local hour with no timezone override; this limitation is undocumented in `docs/protocol.md` or a FAQ.
- **No lint/format policy.** No ESLint / Prettier / Biome config; `npm run ci` runs `tsc` + `node:test` + `npm pack --dry-run` only. The choice is fine, but it is currently implicit in CONTRIBUTING.
- **Registry protocol has a single real user.** Only the built-in demo provider exercises publish/list/subscribe/remove in production; the pilot risk is protocol drift without a second integrator.
- **Command handlers lack behavioral tests.** `tests/extension.test.ts` asserts registration only; `/widget-host:setup`, `/widget-host:policy`, and mute/unmute flows have no direct handler coverage.
- **npm audit backlog.** `npm install` currently reports transitive dev-dependency vulnerabilities; triage and safe bumps belong in a bounded maintenance window.

---

## 5. Candidate maintenance seeds

Each seed is intentionally bounded to **30–90 minutes** and ships behind a green `npm run ci`. Pick one per maintenance window. Seeds are candidates, not commitments — promote a seed to a tracked issue when you start it.

> How to run the gate locally: `npm install && npm run ci` (typecheck + tests + `npm pack --dry-run`).

### Seed 5 — Document the local-timezone time-block limitation  ·  ~30–45 min

Stop the silent surprise for provider authors in non-local-TZ environments.

- **Why:** `detectTimeBlock` uses the host machine's local hour; presets like `focus-day` and `night-owl` behave differently across machines without any config override. This is easy to misread when debugging provider priority.
- **Acceptance**
  - A "Limitations" section in `docs/protocol.md` (or a new `docs/faq.md`) explains that `detectTimeBlock` uses the host's local hour with no TZ override.
  - `README.md` or `docs/README.md` links to it.
  - `npm run ci` is green.

### Seed 7 — Record the lint/format policy decision  ·  ~45–60 min

Make the implicit explicit so new contributors do not guess.

- **Why:** There is no ESLint/Biome/Prettier config and no written rationale; maintenance agents waste time re-deciding whether to add one on every docs-only PR.
- **Acceptance**
  - Either a short decision note in `CONTRIBUTING.md` (or a `docs/decisions/` ADR) stating the current "tsc + `node:test` + `npm pack --dry-run` only" policy and when it would change, **or** a minimal Biome/ESLint config plus an `npm run lint` script wired into `npm run ci`.
  - `npm run ci` is green.

### Seed 8 — Add an in-repo second-provider integration test  ·  ~60–90 min

Exercise the registry with two competing publishers before the external pilot.

- **Why:** Every production path today assumes one demo provider; a focused test with two synthetic registry entries would catch selection, mute, and stale-TTL edge cases the demo provider alone cannot surface.
- **Acceptance**
  - New test(s) in `tests/` publish two distinct provider entries through `getWidgetHostRegistry()`, assert winner selection under preset change, mute, and stale TTL, without wall-clock timing.
  - No change to shipped runtime behavior unless a bug is found and fixed in the same PR.
  - `npm run ci` is green.

### Seed 9 — Triage npm audit findings on dev dependencies  ·  ~30–60 min

Keep the install surface honest for maintainers.

- **Why:** `npm install` currently reports moderate/high vulnerabilities in transitive dev dependencies; ignoring them erodes trust in the CI gate even when runtime deps are clean.
- **Acceptance**
  - Run `npm audit`, document findings in the PR, and land safe `npm audit fix` (or targeted dev-dependency bumps) without breaking `npm run ci`.
  - If a finding is accepted risk, note it in `CONTRIBUTING.md` or a short `docs/security.md` stub with rationale.
  - `npm run ci` is green.

### Seed 10 — Cover one `/widget-host:*` command handler path  ·  ~45–60 min

Move extension coverage from registration to behavior.

- **Why:** Command registration is tested but handler side effects (config writes, notifications, widget updates) are not; this is the most likely regression surface during the 0.4.0 pilot.
- **Acceptance**
  - New test(s) in `tests/extension.test.ts` (or a sibling file) invoke at least one command handler (e.g. `/widget-host:mute` or `/widget-host:policy`) with injected UI/config mocks and assert persisted config or widget output.
  - `npm run ci` is green.

---

## 6. Shipped maintenance seeds (archive)

These bounded tasks landed since the last roadmap refresh and are kept here for traceability. Do not re-seed unless regressions appear.

| Seed | Shipped | Notes |
|---|---|---|
| Seed 3 — Config schema docs | 2026-07 | `docs/config.md` + malformed-input test in `tests/config.test.ts`. |
| Seed 4 — Stale-TTL & subscribe refresh tests | 2026-08 (`0.3.6`) | `tests/host-refresh.test.ts` (DOT-1696). |
| Seed 6 — Docs index | 2026-07 | `docs/README.md` linked from README and package tests. |

---

## 7. Conventions for updating this roadmap

- Update §1 whenever a version ships or a dependency floor moves.
- Promote a §5 seed to "in progress" by opening a tracking issue; move finished seeds to §6 and the relevant release line in §3.
- Keep each seed bounded to 30–90 minutes with explicit acceptance criteria — if a seed grows past that, split it.
- This file does not ship in the npm package, so roadmap edits never require a version bump or publish on their own.
