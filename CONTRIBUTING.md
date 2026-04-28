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

Releases are published locally. Before any publish, verify your environment:

```sh
npm whoami       # must return your npm username
npm get registry # must return https://registry.npmjs.org/
```

Then run the full validation suite:

```sh
npm run validate
```

### Prerelease (e.g. `0.2.0-beta.1`)

- [ ] Bump the version in `package.json` (follow [Semantic Versioning](https://semver.org);
  use a prerelease identifier for releases not ready for general use)
- [ ] Update `CHANGELOG.md`:
  - Rename `[Unreleased]` to `[0.2.0-beta.1] - YYYY-MM-DD`
  - Add a fresh empty `[Unreleased]` section above it
  - Update the comparison links at the bottom of the file
- [ ] Commit the version bump: `git commit -am "ops: bump prerelease version 0.2.0-beta.1"`
- [ ] Merge to `main`
- [ ] Tag and push:
  ```sh
  git tag v0.2.0-beta.1
  git push origin v0.2.0-beta.1
  ```
- [ ] Publish:
  ```sh
  npm publish --tag beta
  ```
  `prepublishOnly` runs some checks and then `npm run build && npm pack --dry-run` automatically.
- [ ] Verify: `npm info cypress-test-order-randomizer` should show the new
  version under the `beta` dist-tag

Users install a prerelease with e.g.: `npm install cypress-test-order-randomizer@beta`

### Stable release (e.g. `1.0.0`)

Follow the same checklist as a prerelease, with these differences:

- Omit `--tag prereleaseName` when publishing — `latest` is the default and is what plain `npm install` resolves to
- Verify the `latest` dist-tag updated in `npm info cypress-test-order-randomizer`

Users install the latest stable release with: `npm install cypress-test-order-randomizer`
