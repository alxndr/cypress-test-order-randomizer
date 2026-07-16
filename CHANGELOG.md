# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).


## [Unreleased]

### Changed

- Upgraded `vitest` to v4, including a minor refactor to tests to work with TypeScript and avoid disabling an ESLint rule
- Upgraded `esbuild` & `oxlint` minor versions
- Upgraded packages used in CI ([#12](https://github.com/alxndr/cypress-test-order-randomizer/pull/12))
- Specify in `CONTRIBUTING.md` that tagging releases is required
- Add a link to `CHANGELOG.md`


## [1.1.0] - 2026-07-15

### Fixed

- [Cypress v15.17.0 (released 2026-06-09)](https://github.com/cypress-io/cypress/releases/tag/v15.17.0)
  started using strict Node ESM loading, which causes the `import {glob} from 'fast-glob'` line in
  [the `file-randomizer.ts` of v1.0.0](https://github.com/alxndr/cypress-test-order-randomizer/blob/adf4e9e34a864/src/file-randomizer.ts#L1)
  to throw an error when running Cypress. This was fixed by replacing `fast-glob`
  with Node's `fs.promises.glob`; see the **Changed** section below.
  - The error looks like this on MacOS:
     ```
     Your configFile is invalid: /[path-to-repo]/cypress.config.ts

     It threw an error when required, check the stack trace below:

     file:///[path-to-repo]/node_modules/cypress-test-order-randomizer/dist/file-randomizer.js:1
     import { glob } from 'fast-glob';
            ^^^^
     SyntaxError: The requested module 'fast-glob' does not provide an export named 'glob'
       at #asyncInstantiate (node:internal/modules/esm/module_job:319:21)
       at process.processTicksAndRejections (node:internal/process/task_queues:104:5)
       at async ModuleJob.run (node:internal/modules/esm/module_job:422:5)
       at async onImport.tracePromise.__proto__ (node:internal/modules/esm/loader:661:26)
       at async loadFile (/[path-to-cypress]/Cypress/15.18.1/Cypress.app/Contents/Resources/app/packages/server/lib/plugins/child/run_require_async_child.js:74:21)
       at async EventEmitter.<anonymous> (/[path-to-cypress]/Cypress/15.18.1/Cypress.app/Contents/Resources/app/packages/server/lib/plugins/child/run_require_async_child.js:82:38)
     ```

- `engines.node` claimed `>=22.0.0`, but `fs.promises.glob` (see below) didn't
  unflag until Node 22.2.0. Bumped to `>=22.2.0` to match reality.

### Changed

- **Replaced the `fast-glob` dependency with Node's built-in
  `fs.promises.glob`.** The CJS/ESM export mismatch above was a symptom of a
  broader fragility in `fast-glob` (a CJS-only package whose named exports
  are runtime-attached properties, invisible to strict ESM loaders) — rather
  than just patch around one instance of it, the dependency is gone
  entirely, along with that whole class of bug. No change to
  `resolveSpecFiles`'s behavior or this package's public API.
- upgraded Cypress (devDependency, used for this package's own e2e tests) to
  15.18.1
- `test/e2e.mjs` gained a fast preflight check that loads the built
  `dist/index.js` under plain `node --input-type=module`, independent of
  Cypress's own (version-dependent) config-loading behavior, so this class
  of regression is caught immediately rather than only after a slow Cypress
  run fails
- upgraded Vitest to v3


## [1.0.0] - 2026-05-08

### Changed

- README documents that Cypress's `--spec` flag bypasses `randomizeFiles`
  (file-order shuffle), while `randomizeBlocks` continues to work; includes a
  workaround using `--config specPattern=` instead
- Upgraded dev dependencies: Cypress, OXLint, esbuild (no consumer impact)
- CI uses newer versions of the GitHub Actions packages

### Removed

- The preprocessor-internal types `CypressPreprocessorFile` and
  `PreprocessorOptions` are no longer exported by the final build [2f710aed]
- `package.json` no longer specifies the NPM version in `engines`.


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


[Unreleased]: https://github.com/alxndr/cypress-test-order-randomizer/compare/v1.1.0...HEAD
[1.1.0]: https://github.com/alxndr/cypress-test-order-randomizer/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/alxndr/cypress-test-order-randomizer/compare/v0.1.0-beta.3...1.0.0
[0.1.0-beta.3]: https://github.com/alxndr/cypress-test-order-randomizer/compare/v0.1.0-beta.2...v0.1.0-beta.3
[0.1.0-beta.2]: https://github.com/alxndr/cypress-test-order-randomizer/compare/v0.1.0-beta.1...v0.1.0-beta.2
[0.1.0-beta.1]: https://github.com/alxndr/cypress-test-order-randomizer/compare/v0.1.0-alpha.2...v0.1.0-beta.1
[0.1.0-alpha.2]: https://github.com/alxndr/cypress-test-order-randomizer/compare/v0.1.0-alpha.1...v0.1.0-alpha.2
[0.1.0-alpha.1]: https://github.com/alxndr/cypress-test-order-randomizer/releases/tag/v0.1.0-alpha.1
