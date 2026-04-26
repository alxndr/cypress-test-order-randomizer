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

- [ ] ensure that we are asserting on the various structures that are in the integration suite's test examples in fixtures
- [ ] set up CI running static analysis and tests, using GitHub Actions (triggered by all branches)
  - use `npm ci --ignore-scripts`

## meta

- [x] Choose and apply an open-source license (MIT, Apache-2.0, ISC, etc.), then remove `"private": true` and update `"license"` in `package.json`
- [ ] Add `"files"` field to `package.json` before publishing
- [ ] TypeScript declarations auto-generated via `tsc` into `dist/` (see `tsconfig.build.json`)
