# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed

- Block-order shuffle now uses a project-relative file path when deriving the
  per-file PRNG seed, so a given seed reproduces the same block order on any
  machine regardless of where the project is checked out. Previously the
  absolute path was used, causing CI and local block shuffles to silently
  diverge. **Note:** this changes the shuffle produced by any existing seed for
  block ordering; seeds captured before this fix will not reproduce the same
  block order after upgrading.


## [0.1.0-beta.1] - 2026-04-26

First public beta release.

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
- Seed is printed at startup and again after all specs finish (via
  `after:run`), making it easy to spot in the results summary
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
- CI via GitHub Actions: lint (`oxlint`), typecheck, and unit tests (Vitest) run across a range of supported Node.js versions in parallel, on every PR push and main-branch commit; longer-running end-to-end tests run after those pass, on a single Node.js version

### Notes

- Requires Node.js ≥ 22 and Cypress ≥ 15
- `esbuild` is a peer dependency (optional at install time; required at
  runtime when `randomizeBlocks` is enabled)
- Cypress does not guarantee execution order from an array `specPattern`
  (open issues [#31758](https://github.com/cypress-io/cypress/issues/31758),
  [#29067](https://github.com/cypress-io/cypress/issues/29067)), so file-order
  randomization is best-effort
