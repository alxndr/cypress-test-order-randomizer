# Project Plan

The goal is to create a TypeScript/NodeJS tool which implements a plugin for Cypress (https://cypress.io).

Our plugin will adjust the execution order of the test files that Cypress runs, as well as the `describe` and `it` blocks defined in them.

Let's aim to test-drive our code where possible.


## TypeScript setup

- [ ] Migrate to TypeScript v6 when it is released and stable


## Cypress v15 Plugin Architecture

### `file:preprocessor` contract


- [x] `on('file:preprocessor', handler)` — handler receives a file EventEmitter with:
  - `file.filePath` — absolute path to the source spec
  - `file.outputPath` — where the bundled output should be written
  - `file.shouldWatch` — whether to watch for changes
- [x] Handler must return a **Promise that resolves with `file.outputPath`** (a string)
- [x] The output must be a **browser-ready bundle** (not just transformed source)
- [x] Cache watchers; the handler may be called multiple times with the same `filePath`
- [x] Listen to `file.on('close', ...)` to clean up watchers
- [x] Emit `file.emit('rerun')` after reprocessing a changed file


### File ordering

- [x] Modify `config.specPattern` (array of absolute paths) before returning from `setupNodeEvents`
    - Cypress does not guarantee execution order from an array (open issues #31758, #29067), so this is best-effort


### Bundling

- [x] Use esbuild as the bundler inside the preprocessor (handles JS/TS/JSX/TSX natively)
- [x] Wire AST transformation in as an esbuild plugin (transform source before esbuild bundles)
- [x] esbuild resolves imports from the original `filePath`, so relative imports in spec files stay correct


### deploying

- [ ] ...how do we deploy?


### following best practices?

- [ ] review some web sources (ensuring the content is up-to-date!) to identify best practices for shipping a Cypress plugin, and then verify whether we are doing things correctly
    - https://dev.to/sebastianclavijo/the-quirky-guide-to-crafting-and-publishing-your-cypress-npm-plugin-2pii
    - https://glebbahmutov.com/blog/publishing-cypress-command/
    - https://pradappandiyan.medium.com/how-to-create-a-cypress-utility-library-and-publish-it-to-npm-410eb1bd2e95


## core

- [x] discuss increase seeding randomness?
  * comment in e2e test suite says "3! = 6; ~17% chance seed=42 happens to preserve order — acceptable" ... but can we make it more likely that the seed value produces a unique run order? perhaps seeds need to be longer to provide that guarantee?


## tests

- [x] ensure that we are asserting on the various structures that are in the integration suite's test examples in fixtures
- [x] verify that the three configuration options (`randomizeFiles`, `randomizeBlocks`, `seed`) can be set via calling the `defineConfig` function or via passing env vars
    - [x] verify that values passed with env vars supercede the configuration set via the `defineConfig` function
- [x] set up CI running static analysis and tests, using GitHub Actions (triggered by all branches)
  - [x] use `npm ci --ignore-scripts`
  - [x] ensure everything is running correctly and passes on CI
- [x] ensure everything works in a separate app's Cypress suite 🎉


## ux

- [x] we add the seed value to the "Results" summary which Cypress prints out after a test suite runs


## meta

- [x] Choose and apply an open-source license (MIT, Apache-2.0, ISC, etc.), then remove `"private": true` and update `"license"` in `package.json`
- [ ] Add `"files"` field to `package.json` before publishing
- [x] TypeScript declarations auto-generated via `tsc` into `dist/` (see `tsconfig.build.json`)
