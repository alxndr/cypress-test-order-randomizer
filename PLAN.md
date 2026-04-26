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

### Cypress `--env` passthrough

Users should be able to override plugin options from the command line without changing `cypress.config.ts`:

```
npx cypress run --env seed=42
npx cypress run --env seed=42,randomizeBlocks=false
```

**Implemented.** The correct priority order is:

1. `config.env.seed` / `config.env.randomizeFiles` / `config.env.randomizeBlocks` — CLI `--env` flag or `env:` block in `cypress.config.ts`; wins over everything so CI and one-off runs can always override
2. `options.seed` / `options.randomizeFiles` / `options.randomizeBlocks` — programmatic defaults set in `setupNodeEvents`; version-controlled project defaults
3. Built-in defaults (`randomizeFiles: true`, `randomizeBlocks: true`, random seed)

The `CypressPluginConfig` interface needs `env?: Record<string, unknown>` added, and string-to-boolean coercion is needed for `randomizeFiles`/`randomizeBlocks` (all `--env` values arrive as strings).

**The `options` object is fully optional** — once `--env` passthrough is in place, `definePlugin(on, config)` (no third argument) is a valid and complete configuration for users who want to control everything from the CLI.

**The registration line itself is irreducible.** Cypress v15 requires explicit `setupNodeEvents` wiring; there is no auto-registration path. The minimum viable `cypress.config.ts` touchpoint is:

```typescript
setupNodeEvents(on, config) {
  return definePlugin(on, config)
}
```


## tests

- [x] `test/seeded-random.test.ts` — unit tests for PRNG and shuffle
- [x] `test/block-randomizer.test.ts` — unit tests for AST block shuffling
- [x] `test/file-randomizer.test.ts` — unit tests using real temp dirs and globs
- [x] `test/preprocessor.test.ts` — integration tests for the esbuild preprocessor
- [x] Ensure that the plugin is tested against a real Cypress v15 run — `scripts/e2e.mjs` + `npm run test:e2e`

### integration test scenarios

Covered by `test/definePlugin.test.ts` (unit-level, fast) and `scripts/e2e.mjs` (real Cypress process, slow).

#### file ordering
- [x] Multiple spec files run in a shuffled order (not the glob default)
- [x] Same seed → same file order reproduced across runs
- [x] `randomizeFiles: false` → files remain in original glob order
- [x] Single spec file → runs without error
- [x] No files match `specPattern` → graceful no-op

#### block ordering
- [x] Multiple `it` blocks within a spec are reordered
- [x] Multiple top-level `describe` blocks at module scope are reordered
- [x] Nested `describe` scopes are each shuffled independently
- [x] Same seed → same block order reproduced across runs
- [x] `randomizeBlocks: false` → original declaration order preserved within each spec
- [x] Hooks (`beforeEach`, `afterEach`, `before`, `after`) remain at their original statement positions

#### spec content compatibility
- [x] TypeScript specs (`.cy.ts`) parse and bundle correctly
- [x] JSX specs (`.cy.tsx`) parse and bundle correctly
- [x] Specs with relative imports (`../support/helpers`) resolve correctly after esbuild bundling
- [x] `describe.only`, `it.only`, `it.skip` are shuffled like their plain variants
- [x] Empty `describe` body does not crash
- [x] Spec with no test blocks passes through unchanged

#### seed behaviour
- [x] String seed produces a reproducible run
- [x] Numeric seed produces a reproducible run
- [x] `42` (number) and `'42'` (string) produce the same shuffle (both stringify to `'42'`)
- [x] No seed provided → a random seed is auto-generated and printed to stdout
- [x] Auto-generated seed printed to stdout so a flaky run can be reproduced by re-using it

#### configuration combinations
- [x] `{ randomizeFiles: true,  randomizeBlocks: true  }` — default; both shuffle
- [x] `{ randomizeFiles: false, randomizeBlocks: true  }` — only block order shuffled
- [x] `{ randomizeFiles: true,  randomizeBlocks: false }` — only file order shuffled
- [x] `{ randomizeFiles: false, randomizeBlocks: false }` — effective no-op / pass-through

### end-to-end (`test:e2e`) — real Cypress run against a fixture project ✓

**Implemented.** `npm run build && node scripts/e2e.mjs`

Fixture layout:
```
fixtures/
  cypress.config.mjs     ← imports definePlugin from ../../dist/index.js; no options
  e2e/
    suite-a.cy.ts        ← 6 it-blocks (A1–A6)
    suite-b.cy.ts        ← 6 it-blocks (B1–B6)
    suite-c.cy.ts        ← nested: inner-1 (C1–C6) + inner-2 (C7–C12)
```

Uses `--reporter json-stream` (Cypress 15 ignores `--reporter-options output=`; json-stream emits one JSON line per event so `["pass",{...}]` lines can be filtered from stdout without any file I/O).

10 checks across 5 Cypress runs; all pass.

### static analysis

- [x] add a npm script for type-checking the codebase (`"typecheck": "tsc --noEmit"`)
- [x] add a linting setup (OXLint v1.61) with npm script (`"lint": "oxlint src/ test/"`)


## developer experience

- [ ] File watcher script (`scripts/dev.mjs`) using `node:fs watch()` with debounce — watches `src/` and `test/`, runs `lint && test` on change via `node:child_process`; add a `"dev"` npm script pointing to it (zero new dependencies)


## meta

- [x] Choose and apply an open-source license (MIT, Apache-2.0, ISC, etc.), then remove `"private": true` and update `"license"` in `package.json`
- [ ] Add `"files"` field to `package.json` before publishing
- [ ] TypeScript declarations auto-generated via `tsc` into `dist/` (see `tsconfig.build.json`)
