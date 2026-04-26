# Project Plan

The goal is to create a TypeScript/NodeJS tool which implements a plugin for Cypress (https://cypress.io).

Our plugin will adjust the execution order of the test files that Cypress runs, as well as the `describe` and `it` blocks defined in them.

Let's aim to test-drive our code where possible.


## TypeScript setup

- [ ] Migrate to TypeScript v6 when it is released and stable


## Cypress v15 Plugin Architecture

Cypress v15 (current: v15.14.1) requires Node.js 20+. Our package targets `>=22.0.0`.


### Plugin registration

Users add this to their `cypress.config.js` or `cypress.config.ts`:

```ts
import { definePlugin } from 'cypress-test-order-randomizer'
import { defineConfig } from 'cypress'

export default defineConfig({
  e2e: {
    setupNodeEvents(on, config) {
      return definePlugin(on, config, {
        randomizeFiles: true,
        randomizeBlocks: true,
        seed: 'optional-fixed-seed',
      })
    }
  }
})
```

### `file:preprocessor` contract

- [ ] `on('file:preprocessor', handler)` — handler receives a file EventEmitter with:
  - `file.filePath` — absolute path to the source spec
  - `file.outputPath` — where the bundled output should be written
  - `file.shouldWatch` — whether to watch for changes
- [ ] Handler must return a **Promise that resolves with `file.outputPath`** (a string)
- [ ] The output must be a **browser-ready bundle** (not just transformed source)
- [ ] Cache watchers; the handler may be called multiple times with the same `filePath`
- [ ] Listen to `file.on('close', ...)` to clean up watchers
- [ ] Emit `file.emit('rerun')` after reprocessing a changed file


### File ordering

- [ ] Modify `config.specPattern` (array of absolute paths) before returning from `setupNodeEvents`
    - Cypress does not guarantee execution order from an array (open issues #31758, #29067), so this is best-effort


### Bundling

- [ ] Use esbuild as the bundler inside the preprocessor (handles JS/TS/JSX/TSX natively)
- [ ] Wire AST transformation in as an esbuild plugin (transform source before esbuild bundles)
- [ ] esbuild resolves imports from the original `filePath`, so relative imports in spec files stay correct


## core

- [ ] discuss increase seeding randomness?
  * comment in e2e test suite says "3! = 6; ~17% chance seed=42 happens to preserve order — acceptable" ... but can we make it more likely that the seed value produces a unique run order? perhaps seeds need to be longer to provide that guarantee?


## user-experience

These options will be tested in the forthcoming integration tests...

- [ ] verify that the three configuration options (`randomizeFiles`, `randomizeBlocks`, `seed`) can be set via calling the `defineConfig` function or via passing env vars
    - [ ] verify that values passed with env vars supercede the configuration set via the `defineConfig` function


## tests

- [x] ensure that we are asserting on the various structures that are in the integration suite's test examples in fixtures
- [x] set up CI running static analysis and tests, using GitHub Actions (triggered by all branches)
  - [x] use `npm ci --ignore-scripts`
  - [ ] ensure everything is running correctly and passes on CI


## meta

- [x] Choose and apply an open-source license (MIT, Apache-2.0, ISC, etc.), then remove `"private": true` and update `"license"` in `package.json`
- [ ] Add `"files"` field to `package.json` before publishing
- [ ] TypeScript declarations auto-generated via `tsc` into `dist/` (see `tsconfig.build.json`)
