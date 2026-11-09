# Changelog

All notable changes to this project will be documented in this file.

This project follows semantic versioning.

## [0.3.21] - 2026-11-10

### Changed

- Raise the `pi-widget-core` runtime floor to `^0.1.11` so `package.json` matches
the lockfile resolution Dependabot PR #89 produced. The dependency update itself
is correct; only the declared floor was left behind, which failed the
`production dependency floors match lockfile resolutions` case in `npm test`.

## [0.3.20] - 2026-11-08

### Changed

- Align Pi SDK dev/test pins with 1.5.0 and refresh the compatibility smoke evidence.
- Document the 1.5.0 API surface this package relies on: no tools, TypeBox schemas,
  or `pi.exec()` options are used, so the `pi-schema` tool-validation change and
  the `pi-ai` TypeBox re-export removal need no migration here.

## [0.3.19] - 2026-11-05

### Changed

- Align Pi SDK dev/test pins with 1.4.0 and refresh the compatibility smoke evidence.
- The compatibility smoke now reads the expected Pi SDK version from the `package.json` devDependency pin instead of a hard-coded literal, so a dependency bump can no longer leave `npm run ci` asserting a stale version. The static assertion fails closed when no pin is supplied.

## [0.3.18] - 2026-11-04

### Fixed

- Stop the built-in demo provider from republishing unchanged content on every host refresh. Each publication notified host subscribers, which re-entered `refreshHostWidget` and published again, so one external provider event produced an unbounded refresh loop. A refresh now republishes only when the rendered content changed or the published entry has gone stale, which keeps `ttlMs` freshness intact.

## [0.3.17] - 2026-10-27

### Changed

- Add a runnable quick-start command for launching the host in a Pi session.

## [0.3.16] - 2026-10-18

### Changed

- Align Pi SDK dev/test pins with 1.3.0 and refresh the compatibility smoke evidence.

## [0.3.15] - 2026-10-16

### Changed

- Align Pi SDK dev/test pins with 1.2.0 and verify the actual extension host in CI.

## [0.3.14] - 2026-10-12

### Changed

- Align Pi SDK dev/test pins with 1.1.0 and verify the actual extension host in CI.

## [0.3.13] - 2026-10-12

### Changed

- Reduce policy tag normalization allocations while preserving tag order and scoring.

## [0.3.12] - 2026-09-30

### Changed

- Update `@earendil-works/pi-*` dependencies to `0.99.1`.

## [0.3.11] - 2026-09-27

- chore: periodic patch bump after 7+ days without npm publish





All notable changes to this project will be documented in this file.

This project follows semantic versioning.
## [0.3.10] - 2026-09-28

- chore: periodic patch bump after 7+ days without npm publish
## [0.3.9] - 2026-09-28

- chore: periodic patch bump after 7+ days without npm publish
## [0.3.8] - 2026-09-28

- chore: periodic patch bump after 7+ days without npm publish
## [0.3.7] - 2026-09-28

- chore: periodic patch bump after 7+ days without npm publish
## [0.3.6] - 2026-08-22

### Changed

- Merge the 2026-08-22 managed OSS dependency and maintenance PR batch.
## [0.3.5] - 2026-08-04

### Changed

- Bump package version for the Discord release webhook verification.
## [0.3.4] - 2026-07-21

### Added

- `ROADMAP.md` maintenance context for weekly portfolio seeds and bounded micro-tasks.

### Changed

- CONTRIBUTING release instructions now match the auto-release and publish workflow (no `follow-tags`).
- Dependency updates for `pi-widget-core` and development tooling.
## [0.3.3] - 2026-07-04

### Added

- Buy Me a Coffee sponsor button to README and native GitHub funding link via `.github/FUNDING.yml`.
## [0.3.2] - 2026-06-26

### Fixed

- npm Trusted Publishing publish retry after registry configuration fix (no functional changes from 0.3.1).
## [0.3.1] - 2026-06-25

### Changed

- README install and development guidance now matches the current Pi OSS template baseline, including project-local install, `pi -e npm:pi-widget-host`, and `npm run pack:check` (`npm pack --dry-run`) validation in the public docs flow.
- `Package contents` now lists the actual shipped paths instead of unused template resource directories.
## [0.3.0] - 2026-06-24

### Added

- Package-readiness hardening for the first publishable Host-only MVP release boundary.
- Explicit acceptance coverage for `matchday` event boost, known host tags, and silent empty slot behavior.

### Changed

- Minor semver bump marking the completed Host-only MVP: event boost, known tags, registry protocol, and demo-provider dogfooding path.
## [0.2.0] - 2026-06-15

### Added

- Shared-slot host extension with `/widget-host:setup`, `/widget-host:status`, `/widget-host:policy`, `/widget-host:providers`, `/widget-host:mute`, and `/widget-host:unmute`.
- User-global host config under `~/.pi/agent/pi-widget-host-config.json`.
- `globalThis` registry protocol for provider publish/list/remove/subscribe flows.
- Built-in demo provider with silent empty slot behavior.
- Preset-first time block policy plus event boost for `playing-now` and `matchday`.
- Protocol and package docs for the Host-only MVP.

### Changed

- Replaced template placeholders and removed template-only skill, prompt, and theme resources.
## Unreleased

