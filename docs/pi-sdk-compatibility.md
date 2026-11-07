# Pi SDK compatibility

`pi-widget-host` is verified against the frozen Pi SDK 1.4.0 wave. Its optional
`@earendil-works/pi-coding-agent` peer range remains `*`; exact SDK versions are
dev/test pins only. The four direct pins and lockfile are checked by the smoke
harness, which reads the expected version from the `package.json`
devDependency pin instead of a hard-coded literal so a dependency bump cannot
leave it asserting a stale wave.

The SDK 1.4.0 dev/test packages declare Node.js `>=22.19.0`; CI uses Node.js 24.
This does not change the package's Node.js `>=20` runtime requirement because
the Pi SDK packages are not production dependencies.

The extension uses `ExtensionAPI.on` for `session_start` and `session_shutdown`,
`registerCommand` for `/widget-host:*`, and `ctx.hasUI`/`ctx.ui` for UI actions.
No Pi 1.4.0 release note deprecates or removes these APIs, and this package is
unaffected by the 1.4.0 breaking changes: it does not pass the renamed
`telemetryContext` provider request option, does not call the removed
`getPiUserAgent()` helper, and does not call `resolveTranscriptTools()` or read
`TranscriptTools.anchorsAdditions`.

The 1.1.0 through 1.3.0 waves made no breaking change that reached this package.
The 1.2.0 `before_agent_start` event union and startup busy-state constraint do
not apply here either: the package does not subscribe to that event, does not
read its user-only fields, and does not call `sendUserMessage()` during startup.
The verified [Pi extension template 1.2.0 compatibility
guide](https://github.com/eiei114/pi-extension-template/blob/4b0554151161eae665aa2cdc845a2d7df40e4781/docs/pi-sdk-compatibility.md)
records those upstream release-note changes and downstream migration guidance.

Run `npm run smoke:pi` (also included by `npm run ci`) to launch the locally
installed Pi 1.4.0 CLI in isolated RPC processes. The smoke covers command
registration, the enabled demo-provider status response, malformed-config
recovery, a second real process after shutdown, and the native host shell. It
does not mock Pi's loader, lifecycle, or package feature paths. Provider/model
inference is omitted using Pi's offline mode, so no paid inference is requested.
Captured results are committed in `docs/verification/pi-sdk-smoke.json`.
