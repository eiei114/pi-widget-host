# Changelog

All notable changes to this project will be documented in this file.

This project follows semantic versioning.

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
