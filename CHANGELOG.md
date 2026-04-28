# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0-beta.3] - 2026-04-27

### Added

- `CONTRIBUTING.md` covering local development setup, project layout, available
  scripts, PR submission guidelines, and the maintainer release process
- GitHub Actions `publish.yml` workflow for manual npm publishing: triggered via
  `workflow_dispatch` from `main` branch only; dist-tag is inferred
  automatically from the version string (`0.1.0-beta.2` → `--tag beta`,
  `1.0.0` → `--tag latest`)
- E2E test validating the seed-capture-and-replay workflow: runs Cypress without
  a seed, captures the auto-generated seed from stdout, reruns with that seed,
  and asserts the execution order is identical — covering the primary
  reproducibility use case documented in the README
- Unit test asserting that two preprocessors with different `projectRoot` values
  but the same spec path relative to their respective roots produce an identical
  block shuffle for a given seed — directly verifying the `relativeFilePath`
  PRNG seeding behavior introduced in 0.1.0-beta.2
- Unit test verifying that emitting close on a watched spec file (shouldWatch=true)
  tears down the FSWatcher: processes the spec, emits close, writes a new version of
  the file, then asserts that no rerun event fires within a build-sized window —
  confirming the watcher is stopped and no rebuild is triggered

### Changed

- Upgraded internal TypeScript toolchain from v5 to v6; no impact on
  consumers, but the CJS build now requires `"ignoreDeprecations": "6.0"` to
  suppress the `node10` moduleResolution deprecation warning until the
  dual-package build strategy is reworked before TypeScript 7
- CI `push` trigger scoped to `main` branch only, eliminating redundant
  double-triggering when pushing commits to a PR branch


## [0.1.0-beta.2] - 2026-04-26

### Fixed

- Block-order shuffle now uses a project-relative file path when deriving the
  per-file PRNG seed, so a given seed reproduces the same block order on any
  machine regardless of where the project is checked out. Previously the
  absolute path was used, causing CI and local block shuffles to silently
  diverge. **Note:** this changes the shuffle produced by any existing seed for
  block ordering; seeds captured before this fix will not reproduce the same
  block order after upgrading.
- README documentation updated with `relativeFilePath` (relative to project root)


## [0.1.0-beta.1] - 2026-04-26

Seems to be working...

### Added

- Seed is now also printed after all specs finish via `after:run`, making it
  easy to spot in the results summary without scrolling back to the top
- CI tests against multiple Node.js versions in parallel (matrix strategy)

### Notes

- Requires Node.js ≥ 22 and Cypress ≥ 15
- `esbuild` is a peer dependency (optional at install time; required at
  runtime when `randomizeBlocks` is enabled)
- Cypress does not guarantee execution order from an array `specPattern`
  (open issues [#31758](https://github.com/cypress-io/cypress/issues/31758),
  [#29067](https://github.com/cypress-io/cypress/issues/29067)), so file-order
  randomization is best-effort


## [0.1.0-alpha.2] - 2026-04-26

### Fixed

- Unit test for same-seed reproducibility incorrectly used different file paths
  for the two preprocessor runs; because the per-file PRNG seed is derived from
  `${seed}:${filePath}`, different paths produced different shuffles and the
  test was not actually validating reproducibility. Fixed to use the same input
  path for both runs, writing to two separate output files.


## [0.1.0-alpha.1] - 2026-04-26

Initial implementation.

### Added

- `definePlugin(on, config, options)` — the main entry point; call it inside
  `setupNodeEvents` and return the result so Cypress picks up the modified config
- **Spec file order randomization** (`randomizeFiles`): resolves all files
  matching `config.specPattern` and rewrites it as a shuffled absolute-path
  array before Cypress begins execution
- **Block order randomization** (`randomizeBlocks`): registers a
  `file:preprocessor` handler that transforms each spec with an esbuild +
  Babel AST pipeline, shuffling `describe`, `context`, `it`, and `test` blocks
  at every nesting level before the spec is bundled for the browser
- **Reproducible shuffles via seed** (`seed` option): a SHA-256 counter-mode
  PRNG drives all shuffles; passing the same seed reproduces the exact same
  execution order; when no seed is provided, a random one is generated and
  printed to stdout so any run can be replayed
- Seed is printed at startup
- Per-file PRNG derivation (`seed + filePath`) keeps each spec's block shuffle
  independent and stable across partial re-runs
- All three options can be set or overridden at runtime via Cypress's `--env`
  flag, which takes priority over the programmatic `options` argument:
  ```
  npx cypress run --env seed=42,randomizeBlocks=false
  ```
- TypeScript source with dual ESM + CJS output (`dist/`) and bundled `.d.ts`
  declarations; works with both `import` and `require`
- Support for `.ts`, `.tsx`, `.js`, and `.jsx` spec files
- File watcher support: the preprocessor watches for source changes and
  re-bundles + re-shuffles automatically during `cypress open`
- CI via GitHub Actions: lint (`oxlint`), typecheck, and unit tests (Vitest)
  on every PR and main-branch push; longer-running end-to-end tests run after
  those pass, on a single Node.js version


[Unreleased]: https://github.com/alxndr/cypress-test-order-randomizer/compare/v0.1.0-beta.2...HEAD
[0.1.0-beta.3]: https://github.com/alxndr/cypress-test-order-randomizer/compare/v0.1.0-beta.2...v0.1.0-beta.3
[0.1.0-beta.2]: https://github.com/alxndr/cypress-test-order-randomizer/compare/v0.1.0-beta.1...v0.1.0-beta.2
[0.1.0-beta.1]: https://github.com/alxndr/cypress-test-order-randomizer/compare/v0.1.0-alpha.2...v0.1.0-beta.1
[0.1.0-alpha.2]: https://github.com/alxndr/cypress-test-order-randomizer/compare/v0.1.0-alpha.1...v0.1.0-alpha.2
[0.1.0-alpha.1]: https://github.com/alxndr/cypress-test-order-randomizer/releases/tag/v0.1.0-alpha.1
