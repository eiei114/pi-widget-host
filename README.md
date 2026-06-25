# Pi Widget Host

[![CI](https://github.com/eiei114/pi-widget-host/actions/workflows/ci.yml/badge.svg)](https://github.com/eiei114/pi-widget-host/actions/workflows/ci.yml)
[![Publish](https://github.com/eiei114/pi-widget-host/actions/workflows/publish.yml/badge.svg)](https://github.com/eiei114/pi-widget-host/actions/workflows/publish.yml)
[![npm version](https://img.shields.io/npm/v/pi-widget-host.svg)](https://www.npmjs.com/package/pi-widget-host)
[![npm downloads](https://img.shields.io/npm/dm/pi-widget-host.svg)](https://www.npmjs.com/package/pi-widget-host)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Pi package](https://img.shields.io/badge/pi-package-purple.svg)](https://pi.dev/packages)
[![Trusted Publishing](https://img.shields.io/badge/npm-Trusted%20Publishing-blue.svg)](docs/release.md)

> Shared-slot host for managing one prompt-top Pi widget across multiple providers.

## What this is

`pi-widget-host` owns one shared widget slot in Pi and picks a single winner from registered providers.

v1 is a **Host-only MVP**:

- user-global config under `~/.pi/agent/`
- preset-first time-block policy
- `globalThis` registry protocol for future provider packages
- built-in demo provider for setup and dogfooding
- silent empty slot when nothing should render

## Features

- `/widget-host:setup` guided first-run flow
- `/widget-host:status`, `/widget-host:policy`, `/widget-host:providers`
- `/widget-host:mute` and `/widget-host:unmute`
- event boost for `playing-now` and `matchday`
- known host tags: `music`, `sports`, `playing-now`, `matchday`, `idle`

## Install

Install the published npm package with Pi:

```bash
pi install npm:pi-widget-host
```

Install into the current project instead of your user Pi settings:

```bash
pi install npm:pi-widget-host -l
```

Or install from GitHub:

```bash
pi install git:github.com/eiei114/pi-widget-host
```

Try it without permanently installing:

```bash
pi -e npm:pi-widget-host
```

Local development from this repository:

```bash
pi -e .
```

## Quick start

Run the host locally, then open these commands:

```txt
/widget-host:setup
/widget-host:status
/widget-host:providers
```

`/widget-host:setup` asks whether to enable the built-in demo provider and which preset policy to save.

## Commands

- `/widget-host:setup` — save initial preset and optionally enable the demo provider
- `/widget-host:status` — report setup status, preset, and active provider
- `/widget-host:policy` — show or change the saved preset
- `/widget-host:providers` — inspect known provider entries and effective state
- `/widget-host:mute` — mute one provider in host config
- `/widget-host:unmute` — unmute one provider in host config

Commands take no inline arguments. Input is collected with Pi UI prompts.

## Registry protocol

Future provider packages can publish to the host without importing this package at runtime.

- backing: `globalThis`
- symbol: `Symbol.for("pi-widget-host.registry.v1")`
- required fields: `providerId`, `available`, `lines`, `updatedAt`
- optional fields: `priority`, `tags`, `mode`, `ttlMs`

See [`docs/protocol.md`](docs/protocol.md).

## Built-in demo provider

The built-in demo provider exists to prove the host loop first:

- setup enables it explicitly
- it publishes through the same registry protocol as future packages
- it renders provider-owned lines through the shared host slot
- if muted, disabled, or filtered out by policy, the slot disappears

## Package contents

| Path | Purpose |
|---|---|
| `extensions/index.ts` | Pi extension entrypoint and `/widget-host:*` command registration |
| `lib/` | config store, registry protocol, policy evaluation, and demo provider |
| `docs/protocol.md` | registry protocol reference for future provider packages |
| `docs/release.md` | Trusted Publishing release notes |

## Development

```bash
npm install
npm run ci
npm run pack:check
```

`npm run ci` runs typecheck, tests, and pack validation. `npm run pack:check` runs `npm pack --dry-run` to confirm the shipped tarball contents.

## Release

This package uses npm Trusted Publishing.

```bash
npm version patch
git push
```

See [`docs/release.md`](docs/release.md).

## Security

Pi packages execute with your local permissions. Review extensions before installing third-party packages.

For vulnerability reporting, see [`SECURITY.md`](SECURITY.md).

## Links

- npm: https://www.npmjs.com/package/pi-widget-host
- GitHub: https://github.com/eiei114/pi-widget-host
- Issues: https://github.com/eiei114/pi-widget-host/issues

## License

MIT
