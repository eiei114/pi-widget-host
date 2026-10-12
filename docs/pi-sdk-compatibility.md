# Pi SDK 1.1.0 compatibility

`pi-widget-host` is verified against the frozen Pi SDK 1.1.0 wave. Its optional
`@earendil-works/pi-coding-agent` peer range remains `*`; exact SDK versions are
dev/test pins only. The four direct pins and lockfile are checked by the smoke
harness.

The extension uses `ExtensionAPI.on` for session lifecycle events and
`registerCommand` for `/widget-host:*`. The verified baseline migration guide
for this SDK wave is in the [Pi extension template](https://github.com/eiei114/pi-extension-template/blob/main/docs/pi-sdk-compatibility.md).
These APIs are supported in 1.1.0; this package does not use a deprecated SDK
API that needs replacement.

Run `npm run smoke:pi` (also included by `npm run ci`) to launch the locally
installed Pi CLI in isolated RPC processes. The smoke covers command
registration, the enabled demo-provider status response, malformed-config
recovery, a second real process after shutdown, and the native host shell. It
does not mock Pi's loader, lifecycle, or package feature paths. Provider/model
inference is omitted using Pi's offline mode, so no paid inference is requested.
Captured results are committed in `docs/verification/pi-sdk-smoke.json`.
