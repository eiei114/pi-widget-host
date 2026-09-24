# Contributing

Thanks for helping improve this Pi package.

## Development

```bash
npm install
npm run ci
```

## Linting and formatting policy

This repository currently does not require ESLint, Biome, or Prettier. The CI gate is intentionally limited to the checks that match the package's current TypeScript and test setup:

- `tsc --noEmit` via `npm run typecheck`
- `node:test` via `npm test`
- `npm pack --dry-run` via `npm run pack:check`

Together, these checks are run by `npm run ci` and are also the required local gate before opening a pull request. No formatter is enforced today because the project is small, has no existing formatter configuration to preserve, and the current gate catches type, behavior, and package-content regressions without adding a new style tool or formatting churn.

Revisit this decision if the codebase grows enough that consistent automated style enforcement would reduce review or maintenance effort, if contributors begin using incompatible formatting conventions, or if a new lint/format tool becomes a repository-wide CI requirement. Any change should add the tool to the package scripts and `npm run ci` together, with its scope and migration expectations documented here.

## Local Pi testing

```bash
pi -e .
```

## Pull requests

Before opening a PR:

- Run `npm run ci`
- Update docs when behavior changes
- Update `CHANGELOG.md` for user-facing changes
- Keep package contents small and intentional

## Release

Releases use npm Trusted Publishing. Do not add `NPM_TOKEN` to GitHub Secrets.

On `main`, `.github/workflows/auto-release.yml` creates the `v<version>` tag and GitHub Release after a `package.json` version bump, then dispatches `.github/workflows/publish.yml`.

```bash
npm version patch
git push
```

See [`docs/release.md`](docs/release.md) for the full Trusted Publishing workflow.