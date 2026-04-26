# Project Plan

The goal is to create a TypeScript/NodeJS tool which implements a plugin for Cypress (https://cypress.io).

Our plugin will adjust the execution order of the test files that Cypress runs, as well as the `describe` and `it` blocks defined in them.

Let's aim to test-drive our code where possible.


## Cypress v15 Plugin Architecture

Cypress v15 (current: v15.14.1) requires Node.js 20+. Our package targets `>=22.0.0`.

### Plugin registration

Users add this to their `cypress.config.js`:

```js
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

- [ ] TODO: ensure this works with TypeScript

### `file:preprocessor` contract

- `on('file:preprocessor', handler)` — handler receives a file EventEmitter with:
  - `file.filePath` — absolute path to the source spec
  - `file.outputPath` — where the bundled output should be written
  - `file.shouldWatch` — whether to watch for changes
- Handler must return a **Promise that resolves with `file.outputPath`** (a string)
- The output must be a **browser-ready bundle** (not just transformed source)
- Cache watchers; the handler may be called multiple times with the same `filePath`
- Listen to `file.on('close', ...)` to clean up watchers
- Emit `file.emit('rerun')` after reprocessing a changed file

### File ordering

- Modify `config.specPattern` (array of absolute paths) before returning from `setupNodeEvents`
- Cypress does not guarantee execution order from an array (open issues #31758, #29067), so this is best-effort

### Bundling

- Use esbuild as the bundler inside the preprocessor (handles JS/TS/JSX/TSX natively)
- Wire AST transformation in as an esbuild plugin (transform source before esbuild bundles)
- esbuild resolves imports from the original `filePath`, so relative imports in spec files stay correct


## core

- [ ] `src/seeded-random.js` — Mulberry32 PRNG + djb2 string hashing + Fisher-Yates shuffle
- [ ] `src/block-randomizer.js` — AST transform: shuffle `describe`/`it`/`test`/`context` blocks using `@babel/parser` + `@babel/generator`
- [ ] `src/file-randomizer.js` — resolve `specPattern` globs with `fast-glob`, shuffle file list
- [ ] `src/preprocessor.js` — esbuild-based `createPreprocessor` with AST esbuild plugin; handles watcher caching + `close`/`rerun` lifecycle
- [ ] `src/index.js` — `definePlugin(on, config, options)` entry point; re-exports `transformCode` for advanced use


## user-experience

- [ ] `randomizeFiles` option (boolean, default `true`) — whether to shuffle spec file order
- [ ] `randomizeBlocks` option (boolean, default `true`) — whether to shuffle `describe`/`it` blocks within files
- [ ] `seed` option (string | number, optional) — fixed seed for reproducible runs; defaults to a random seed logged to stdout


## tests

- [ ] `test/seeded-random.test.js` — unit tests for PRNG, hashing, and shuffle
- [ ] `test/block-randomizer.test.js` — unit tests for AST block shuffling
- [ ] `test/file-randomizer.test.js` — integration tests using real temp files and globs
- [ ] `test/preprocessor.test.js` — integration tests for the esbuild preprocessor
- [ ] Ensure that the plugin is tested against a fresh installation of Cypress v15


## meta

- [ ] Choose and apply an open-source license (MIT, Apache-2.0, ISC, etc.), then remove `"private": true` and update `"license"` in `package.json`
- [ ] Add `"exports"` and `"files"` fields to `package.json` before publishing
- [ ] Add TypeScript type definitions (`src/index.d.ts`)
