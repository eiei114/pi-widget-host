# Pi SDK 1.2.0 compatibility

`pi-widget-host` is verified against the frozen Pi SDK 1.2.0 wave. Its optional
`@earendil-works/pi-coding-agent` peer range remains `*`; exact SDK versions are
dev/test pins only. The four direct pins and lockfile are checked by the smoke
harness.

The extension uses `ExtensionAPI.on` for `session_start` and `session_shutdown`,
`registerCommand` for `/widget-host:*`, and `ctx.hasUI`/`ctx.ui` for UI actions.
The Pi 1.2.0 release notes do not deprecate or remove these APIs. The changed
`before_agent_start` event union does not affect this package: it does not
subscribe to that event or read its user-only fields. It also does not call
`sendUserMessage()` during startup, so the new startup busy-state constraint
does not require a migration. The verified [Pi extension template 1.2.0
compatibility guide](https://github.com/eiei114/pi-extension-template/blob/4b0554151161eae665aa2cdc845a2d7df40e4781/docs/pi-sdk-compatibility.md)
records the upstream release-note changes and downstream migration guidance.

Run `npm run smoke:pi` (also included by `npm run ci`) to launch the locally
installed Pi 1.2.0 CLI in isolated RPC processes. The smoke covers command
registration, the enabled demo-provider status response, malformed-config
recovery, a second real process after shutdown, and the native host shell. It
does not mock Pi's loader, lifecycle, or package feature paths. Provider/model
inference is omitted using Pi's offline mode, so no paid inference is requested.
Captured results are committed in `docs/verification/pi-sdk-smoke.json`.
