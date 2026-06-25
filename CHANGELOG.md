# Changelog

All notable changes to this project will be documented in this file.

This project follows semantic versioning.

## [0.3.1] - 2026-06-26

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
