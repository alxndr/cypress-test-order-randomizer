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

- [x] `src/seeded-random.ts` — counter-mode SHA-256 PRNG (via `node:crypto`) + Fisher-Yates shuffle; accepts `string | number` seed
- [x] `src/block-randomizer.ts` — AST transform: shuffle `describe`/`it`/`test`/`context` blocks using `@babel/parser` + `@babel/generator`
- [x] `src/file-randomizer.ts` — resolve `specPattern` globs with `fast-glob`, shuffle file list
- [x] `src/preprocessor.ts` — esbuild-based `createPreprocessor` with AST esbuild plugin; handles watcher caching + `close`/`rerun` lifecycle
- [x] `src/index.ts` — `definePlugin(on, config, options)` entry point; re-exports `transformCode` for advanced use


## user-experience

These options will be tested in the forthcoming integration tests...

- [ ] `randomizeFiles` option (boolean, default `true`) — whether to shuffle spec file order
- [ ] `randomizeBlocks` option (boolean, default `true`) — whether to shuffle `describe`/`it` blocks within files
- [ ] `seed` option (string | number, optional) — fixed seed for reproducible runs; defaults to a random seed logged to stdout


## tests

- [x] `test/seeded-random.test.ts` — unit tests for PRNG and shuffle
- [x] `test/block-randomizer.test.ts` — unit tests for AST block shuffling
- [x] `test/file-randomizer.test.ts` — unit tests using real temp dirs and globs
- [x] `test/preprocessor.test.ts` — integration tests for the esbuild preprocessor
- [ ] Ensure that the plugin is tested against a fresh installation of Cypress v15
  - see below for potential integration test scripts

### integration test scenarios

Potential scenarios to drive `test/preprocessor.test.ts` and any future e2e tests against a 'real' (JIT-created) Cypress project.

#### file ordering
- [ ] Multiple spec files run in a shuffled order (not the glob default)
- [ ] Same seed → same file order reproduced across runs
- [ ] `randomizeFiles: false` → files remain in original glob order
- [ ] Single spec file → runs without error
- [ ] No files match `specPattern` → graceful no-op

#### block ordering
- [ ] Multiple `it` blocks within a spec are reordered
- [ ] Multiple top-level `describe` blocks at module scope are reordered
- [ ] Nested `describe` scopes are each shuffled independently
- [ ] Same seed → same block order reproduced across runs
- [ ] `randomizeBlocks: false` → original declaration order preserved within each spec
- [ ] Hooks (`beforeEach`, `afterEach`, `before`, `after`) remain at their original statement positions

#### spec content compatibility
- [ ] TypeScript specs (`.cy.ts`) parse and bundle correctly
- [ ] JSX specs (`.cy.tsx`) parse and bundle correctly
- [ ] Specs with relative imports (`../support/helpers`) resolve correctly after esbuild bundling
- [ ] `describe.only`, `it.only`, `it.skip` are shuffled like their plain variants
- [ ] Empty `describe` body does not crash
- [ ] Spec with no test blocks passes through unchanged

#### seed behaviour
- [ ] String seed produces a reproducible run
- [ ] Numeric seed produces a reproducible run
- [ ] `42` (number) and `'42'` (string) produce the same shuffle (both stringify to `'42'`)
- [ ] No seed provided → a random seed is auto-generated and printed to stdout
- [ ] Auto-generated seed printed to stdout so a flaky run can be reproduced by re-using it

#### configuration combinations
- [ ] `{ randomizeFiles: true,  randomizeBlocks: true  }` — default; both shuffle
- [ ] `{ randomizeFiles: false, randomizeBlocks: true  }` — only block order shuffled
- [ ] `{ randomizeFiles: true,  randomizeBlocks: false }` — only file order shuffled
- [ ] `{ randomizeFiles: false, randomizeBlocks: false }` — effective no-op / pass-through

### static analysis

- [x] add a npm script for type-checking the codebase (`"typecheck": "tsc --noEmit"`)
- [x] add a linting setup (OXLint v1.61) with npm script (`"lint": "oxlint src/ test/"`)


## developer experience

- [ ] File watcher script (`scripts/dev.mjs`) using `node:fs watch()` with debounce — watches `src/` and `test/`, runs `lint && test` on change via `node:child_process`; add a `"dev"` npm script pointing to it (zero new dependencies)


## meta

- [x] Choose and apply an open-source license (MIT, Apache-2.0, ISC, etc.), then remove `"private": true` and update `"license"` in `package.json`
- [ ] Add `"files"` field to `package.json` before publishing
- [ ] TypeScript declarations auto-generated via `tsc` into `dist/` (see `tsconfig.build.json`)
