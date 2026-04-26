# cypress-test-order-randomizer

Like it says on the tin. 🥫

Cypress plugin that randomizes the execution order of your spec files and the `describe`/`it`/`test` blocks within them. Exposes ordering dependencies between tests; makes test suites more robust.


## Installation

```sh
npm install --save-dev cypress-test-order-randomizer
```

esbuild is required for the file preprocessor and is listed as an optional peer
dependency. If you don't already have it:

```sh
npm install --save-dev esbuild
```


## Quick start

```typescript
// cypress.config.ts
import { defineConfig } from 'cypress'
import { definePlugin } from 'cypress-test-order-randomizer'

export default defineConfig({
  e2e: {
    async setupNodeEvents(on, config) {
      return definePlugin(on, config)
    },
  },
})
```

That's it. Both spec-file order and block order are randomized by default.


## Options

```typescript
definePlugin(on, config, {
  randomizeFiles:  true,      // shuffle spec files  (default: true)
  randomizeBlocks: true,      // shuffle describe/it blocks within each spec (default: true)
  seed:            undefined, // string | number — see Seeds section below
})
```

| Option | Type | Default | Description |
|---|---|---|---|
| `randomizeFiles` | `boolean` | `true` | Randomize the order spec files are executed |
| `randomizeBlocks` | `boolean` | `true` | Randomize `describe`/`it`/`test`/`context` blocks within each spec |
| `seed` | `string \| number` | auto | Seed for the random number generator — see below |

> **Note on file ordering.** Cypress does not guarantee spec execution order
> when `specPattern` is an array (open issues
> [#31758](https://github.com/cypress-io/cypress/issues/31758),
> [#29067](https://github.com/cypress-io/cypress/issues/29067)).
> File shuffling is best-effort via `config.specPattern`.


## Seeds & Reproducibility

### Default behaviour — every run is different

When you don't provide a `seed`, the plugin generates a random one at the start
of each run and **prints it to the console**:

```
[cypress-test-order-randomizer] Seed: a8f3c2d1b4e7
```

Every run has a different order. That's the point — a test that only fails in a
specific order is a test with a hidden dependency on another test.

### Reproducing a specific run

When a failure surfaces, copy the seed from the console and pass it back:

```typescript
return definePlugin(on, config, { seed: 'a8f3c2d1b4e7' })
```

Every subsequent run now uses that exact shuffle until you remove or change the
`seed` option.

### Stable-but-rotating seeds for CI

If you want runs to be reproducible within a build but still rotate between
builds, tie the seed to the build identifier:

```typescript
return definePlugin(on, config, {
  seed: process.env.CI_BUILD_ID,  // falls back to a random seed locally
})
```

### String vs number seeds

Seeds can be a `string` or a `number`. Numbers are stringified internally, so
`42` and `'42'` produce **identical** shuffles.

### How a single seed controls both file order and block order

The global `seed` drives two independent shuffles:

| Shuffle | Derived seed | Scope |
|---|---|---|
| File order | `seed` directly | One shuffle of the full spec list |
| Block order (per spec) | `${seed}:${absoluteFilePath}` | One shuffle per spec file |

Because block-level seeds include the file path, two spec files always receive
**different** block shuffles from the same global seed — and those shuffles are
stable and independent of how many files you have or what order they ran in.

### Disabling randomization without removing the plugin

```typescript
return definePlugin(on, config, {
  randomizeFiles: false,
  randomizeBlocks: false,
})
```

Useful for temporarily debugging an ordering issue without touching
`cypress.config.ts` beyond one flag.


## How it works

1. **File order** — `definePlugin` resolves your `specPattern` globs with
   [`fast-glob`](https://github.com/mrmlnc/fast-glob), shuffles the resulting
   list using a seeded PRNG, and replaces `config.specPattern` with the ordered
   array before returning.

2. **Block order** — A custom [esbuild](https://esbuild.github.io/) preprocessor
   intercepts each spec file before it reaches the browser. It parses the source
   with [`@babel/parser`](https://babeljs.io/docs/babel-parser), shuffles
   `describe`/`context`/`it`/`test`/`specify` blocks (and `.only`/`.skip`
   variants) at every nesting level while leaving hooks (`beforeEach`,
   `afterEach`, `before`, `after`), imports, and other statements in place, then
   regenerates the source and hands it to esbuild for bundling.

3. **Reproducibility** — The PRNG is a counter-mode SHA-256 construction built
   on Node.js's built-in `crypto` module. No hand-rolled math.


## inspiration / prior art

This plugin stands on the shoulders of giants:

* the Vitest [`sequence.shuffle` and `sequence.seed` options](https://vitest.dev/config/sequence)

* [Bojan Dimitrovski, "Running Cypress Tests in Random Order"](https://prezi.com/p/xpa-hgs-fbyi/running-cypress-tests-in-random-order/)

* @mncharlton's [`/cypress-random-test-order`](https://github.com/mncharlton/cypress-random-test-order) (unmaintained as of 2021)

* [Cypress issue #2908: Allow for random spec ordering when running tests](https://github.com/cypress-io/cypress/issues/2908)

<details>

* [Cypress issue #390: Ability to run spec files in a specific order](https://github.com/cypress-io/cypress/issues/390)
<summary>including a 2024 implementation by @AlexandreRozier (in turn based on @bahmutov's [@cypress/grep](https://github.com/cypress-io/cypress/blob/0e316966af3f281b3e297cae2d5f4c0c3054f8ed/npm/grep/src/plugin.js)):</summary>

```typescript
    // cypress/plugins/randomizeSpecs.ts
    import * as fs from 'node:fs/promises';
    /**
     * @param {Cypress.ConfigOptions} config
     */
    export default async function randomizeSpecsPlugin(config) {
      if (!config?.env?.randomizedTestsSeed) {
        return config;
      }

      const specPattern = /.*.cy.ts/;
      const integrationFolder = process.cwd();

      const allFiles = await fs.readdir(integrationFolder, { recursive: true });
      const specFiles = allFiles.filter(s => specPattern.exec(s)).map(s => 'cypress/' + s);

      // Run your custom shuffling function here - for me it's modifying specFiles in-place
      shuffle(specFiles);

      // Warning : we're overriding existing specPattern to ensure tests are run with this new order
      // Any existing specPattern will be OVERWRITTEN
      // See https://github.com/cypress-io/cypress/issues/390  as to why we're doing things this way
      config.specPattern = specFiles;
      return config;
    }

    // cypress/cypress.local.config.ts
    import randomizeSpecsPlugin from './plugins/randomizeSpecs';
    ...
    async setupNodeEvents(on, config) {
          await randomizeSpecsPlugin(config);
          return config
    }
```

</details>

* [Cypress issue #390: Ability to run spec files in a specific order](https://github.com/cypress-io/cypress/issues/390)

* @bahmutov's [`rocha`](https://github.com/bahmutov/rocha) (for [Mocha](https://github.com/mochajs/mocha))
