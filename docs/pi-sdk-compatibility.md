# Pi SDK compatibility

`pi-widget-host` is verified against the frozen Pi SDK 1.5.0 wave. Its optional
`@earendil-works/pi-coding-agent` peer range remains `*`; exact SDK versions are
dev/test pins only. The four direct pins and lockfile are checked by the smoke
harness, which reads the expected version from the `package.json`
devDependency pin instead of a hard-coded literal so a dependency bump cannot
leave it asserting a stale wave.

Verified wave (`devDependencies`, exact pins):

- `@earendil-works/pi-agent-core`: `1.5.0`
- `@earendil-works/pi-ai`: `1.5.0`
- `@earendil-works/pi-coding-agent`: `1.5.0`
- `@earendil-works/pi-tui`: `1.5.0`

The SDK 1.5.0 dev/test packages declare Node.js `>=22.19.0`; CI uses Node.js 24.
This does not change the package's Node.js `>=20` runtime requirement because
the Pi SDK packages are not production dependencies.

## 1.5.0 API surface used by this package

The extension uses `ExtensionAPI.on` for `session_start` and `session_shutdown`,
`registerCommand` for `/widget-host:*`, and `ctx.hasUI`/`ctx.ui`
(`setWidget`, `setStatus`, `notify`, `select`) for UI actions. All of these
exist and keep their signatures in 1.5.0.

The package is unaffected by the Pi 1.5.0 breaking changes:

- Tool argument validation moved to `@earendil-works/pi-schema`, which drops
  TypeBox features outside JSON Schema for **tool** arguments. This package
  registers no tools (`registerTool` is never called) and defines no tool
  parameter schemas, so no schema needs a migration.
- `@earendil-works/pi-ai` no longer re-exports TypeBox and its `StringEnum` is
  now a pi-schema `Schema<T>`. This package does not import TypeBox, `Type`,
  `Static`, or `StringEnum` from any Pi package, so there is no typing change
  to absorb.
- `pi.exec()` `maxBuffer`/`truncated`, `Usage.cost.totalFromProvider`,
  `responseModel`, and the `ctx.ui.custom({ blocked })` option are additive.
  The package calls none of them.

The 1.1.0 through 1.4.0 waves made no breaking change that reached this
package either: it does not pass the renamed `telemetryContext` provider
request option, does not call the removed `getPiUserAgent()` helper, does not
call `resolveTranscriptTools()` or read `TranscriptTools.anchorsAdditions`, and
does not subscribe to `before_agent_start` or call `sendUserMessage()` during
startup. The verified [Pi extension template 1.5.0 compatibility
guide](https://github.com/eiei114/pi-extension-template/blob/48e36268d1fd9fec388c2c203d520d8809dfb79d/docs/pi-sdk-compatibility.md)
records those upstream release-note changes and downstream migration guidance
for packages that do use tools or TypeBox.

## Runtime verification

Run `npm run smoke:pi` (also included by `npm run ci`) to launch the locally
installed Pi 1.5.0 CLI in isolated RPC processes. The smoke covers command
registration, the enabled demo-provider status response, malformed-config
recovery, a second real process after shutdown, and the native host shell. It
does not mock Pi's loader, lifecycle, or package feature paths. Provider/model
inference is omitted using Pi's offline mode, so no paid inference is requested.
Captured results are committed in `docs/verification/pi-sdk-smoke.json`
(`verification_contract=pi-sdk-behavior-v2`).

Each snapshot is produced in a temporary agent directory
(`PI_CODING_AGENT_DIR`), so global `~/.pi` settings are never read or written,
and the harness checks all four installed SDK versions against the exact
`package.json` pins before it starts any process.
