# 2026-07-04 npm publish failure investigation

This records the failed `Publish to npm` workflow run without changing release workflows,
package versions, changelog entries, npm registry state, or releases.

## Failed run

- Run: <https://github.com/eiei114/pi-widget-host/actions/runs/28704568448>
- Workflow: `Publish to npm` (`.github/workflows/publish.yml`)
- Event: `workflow_dispatch`
- Selected ref / head branch: `v0.3.3`
- Checked-out object: tag `v0.3.3` -> commit `b7907bc48a57900b7e466a18e6a681184dcda797`
- Run attempt: `1`
- Started: `2026-07-04T11:20:24Z`
- Completed: `2026-07-04T11:20:56Z`
- Conclusion: `failure`

## Package and npm public state

- Package name at the failed ref: `pi-widget-host`
- Package version at the failed ref: `0.3.3`
- Current public npm state: `pi-widget-host@0.3.3` exists and is the `latest` dist-tag.
- `npm view pi-widget-host@0.3.3 version dist-tags time --json` reported:
  - version: `0.3.3`
  - latest: `0.3.3`
  - `0.3.3` publish time: `2026-07-04T11:20:45.499Z`

## Failure output

The failed run validated and packed `pi-widget-host@0.3.3`, then the pre-publish guard
printed `Publishing pi-widget-host@0.3.3.` and allowed `npm publish --access public` to run.
The publish step failed with:

```text
npm error You cannot publish over the previously published versions: 0.3.3.
npm error A complete log of this run can be found in: /home/runner/.npm/_logs/2026-07-04T11_20_52_501Z-debug-0.log
Error: Process completed with exit code 1.
```

A concurrent successful run explains why the guard saw the version as unpublished but the
publish step then hit a duplicate version:

- Successful run: <https://github.com/eiei114/pi-widget-host/actions/runs/28704565106>
- Event/ref: `push` on `main`
- Commit: `b7907bc48a57900b7e466a18e6a681184dcda797`
- Started: `2026-07-04T11:20:16Z`
- `Publish to npm` step ran from `2026-07-04T11:20:42Z` to `2026-07-04T11:20:46Z`
- npm records `0.3.3` as published at `2026-07-04T11:20:45.499Z`
- The failed manual run's duplicate-version error occurred at `2026-07-04T11:20:54Z`

## Cause classification

Classification: **duplicate-version**.

The duplicate was caused by overlapping publish-eligible workflow runs for the same package
version. The automatic `push` run published `0.3.3`; the manual `workflow_dispatch` run on
`v0.3.3` reached `npm publish` seconds later and npm rejected publishing over an existing
version.

This is not currently classified as Trusted Publishing/authentication. The failed run had
`id-token: write`, installed a trusted-publishing-capable npm, and reached npm's duplicate
version validation rather than failing for provenance, OIDC, token, or permission reasons.

## Current workflow behavior

Current `.github/workflows/publish.yml` still allows multiple trigger paths to publish:

- `push` to `main` when package or workflow files change
- tag pushes matching `v*.*.*`
- published GitHub releases
- manual `workflow_dispatch` with an optional `ref`

The workflow has a duplicate-version guard using `npm view "${name}@${version}" version` and
skips only when that query succeeds before the publish step. It is useful for already-published
versions, but it is not an atomic lock: another run can publish the same version after the guard
checks and before `npm publish` runs.

The concurrency group is `npm-publish-${{ github.event.inputs.ref || github.ref }}`. For the
2026-07-04 overlap, the automatic run used a `main` ref while the manual run used `v0.3.3`, so
those two runs did not share a concurrency group even though both targeted `pi-widget-host@0.3.3`.

## Reproducible non-publish check

Use these read-only commands to reproduce the investigation without publishing:

```bash
gh run view 28704568448 \
  --json event,headBranch,headSha,createdAt,updatedAt,conclusion,status,workflowName,url,jobs

gh run view 28704568448 --log-failed

gh run view 28704565106 \
  --json event,headBranch,headSha,createdAt,updatedAt,conclusion,status,workflowName,url,jobs

npm view pi-widget-host@0.3.3 version dist-tags time --json

node -p "require('./package.json').name + '@' + require('./package.json').version"
npm pack --dry-run
```

`npm pack --dry-run` exercises package assembly only; it does not publish.

## Smallest safe correction options

No correction is applied in this investigation slice. Safe follow-up options, from smallest to
more opinionated, are:

1. Treat npm duplicate-version failures as a successful no-op when a post-failure `npm view
   "${name}@${version}" version` confirms the same version is public. This preserves all current
   triggers and makes publish races idempotent.
2. Change the concurrency group to a package-version-derived value after checkout, or otherwise
   serialize all publish attempts that target the same `package.json` version. GitHub workflow-level
   concurrency cannot directly read `package.json`, so this likely needs a small pre-publish lock
   design rather than only editing the existing top-level group.
3. Reduce publish trigger overlap by making one path authoritative, such as publishing only from
   release/tag events and keeping manual dispatch for recovery after maintainer review.

Any follow-up should remain release-owner approved because it changes release workflow behavior.
