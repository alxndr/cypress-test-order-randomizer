# Contributing

## Local development

Targeting NodeJS >= v22 and NPM >= 11.10.

```sh
git clone git@github.com:alxndr/cypress-test-order-randomizer.git
cd cypress-test-order-randomizer
npm install
```

`esbuild` is a devDependency; it should be installed after `npm install` without a separate step necessary.


## Project layout

```
src/
  index.ts              — plugin entry point; exports definePlugin()
  block-randomizer.ts   — Babel AST transform that shuffles describe/it blocks
  preprocessor.ts       — esbuild plugin wrapper; applies the transform per spec file
  file-randomizer.ts    — glob resolution and spec-file order shuffle
  seeded-random.ts      — SHA-256 counter-mode PRNG and Fisher-Yates shuffle
  babel-generator.d.ts  — type shim for @babel/generator's CJS/ESM interop quirk

test/
  *.test.ts             — Vitest tests; most source modules have one unit test file;
                          src/index.ts has two: index.test.ts (unit) and
                          definePlugin.test.ts (pseudo-integration — mocks the full
                          plugin invocation without a real Cypress process)
  e2e.mjs               — Node.js script that drives a real Cypress run and
                          asserts on output, integration-style
  fixtures/             — minimal Cypress project used by the e2e test
```


## Available scripts

| Script | What it does |
|---|---|
| `npm run lint` | oxlint on `src/` and `test/` |
| `npm run typecheck` | `tsc --noEmit` across src and test |
| `npm run test:unit` | Vitest unit tests |
| `npm run test:watch` | Vitest in watch mode — reruns affected tests on file save |
| `npm run test:e2e` | builds, then runs the Cypress fixture project via `test/e2e.mjs` |
| `npm run validate` | lint + typecheck + test:unit + test:e2e — what CI runs |
| `npm run build` | emits `dist/` (ESM + CJS + type declarations) |


## Submitting a PR

1. Branch off `main`.
2. Run `npm run validate` locally before pushing — CI runs the same checks and
   will block the PR if they fail.
3. CI runs the `validate` job across a matrix of Node.js versions, then the
   `e2e` job on a single version once `validate` passes.


## Maintainer: cutting a release

1. **Bump the version** in `package.json`. Follow [Semantic Versioning](https://semver.org).
   Use a prerelease identifier for releases that aren't ready for general use
   (e.g. `0.2.0-beta.1`).

2. **Update `CHANGELOG.md`** — promote the `[Unreleased]` section to a versioned
   entry with today's date (e.g. `[0.2.0-beta.1] - 2026-05-01`), and leave a
   fresh empty `[Unreleased]` section at the top.

3. **Merge to `main`.**

4. **Trigger the publish workflow** from the GitHub Actions UI (Actions →
   Publish → Run workflow). The workflow must be run from the `main` branch.
   It will lint, typecheck, unit-test, and build before publishing.

   The dist-tag is inferred automatically from the version string:
   - `0.2.0-beta.1` → published as `--tag beta` (users need `npm install cypress-test-order-randomizer@beta`)
   - `1.0.0` → published as `--tag latest` (default for plain `npm install`)

   The workflow requires an `NPM_TOKEN` secret to be configured in the
   repository settings (Settings → Secrets → Actions).

5. **Verify the registry** before triggering if doing a manual publish outside
   the workflow. If your local npm config points at a private or corporate
   registry, `npm publish` will go there instead of the public registry.
   Check with `npm get registry` — it should return `https://registry.npmjs.org/`.
   The GitHub Actions workflow is not affected by this (its registry is set
   explicitly via `setup-node`'s `registry-url`).
