# cypress-test-order-randomizer

This [Cypress](https://cypress.io) v15 plugin randomizes the execution order of your test suite.

It allows for independently shuffling the order in which test files are run, and the order of the `describe`/`it`/`test` blocks within them. The seed value printed at the start/end of each run identifies the shuffled order, and providing it when running on the same set of input tests should reproduce the same order of test execution.

Much of this code was written by Claude Code, with human supervision.


## ...why??

Predictably randomizing the order of your tests can expose unintentional execution-ordering dependencies between tests. Using a seed value for the ordering means that we can reliably recreate a given ordering once it's been generated.

TLDR: it can help make test suites more robust.


## Installation

Requires Node.js ≥ 22.

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
import { definePlugin as definePluginTestRandomizer } from 'cypress-test-order-randomizer'

export default defineConfig({
  e2e: {
    async setupNodeEvents(on, config) {
      return definePluginTestRandomizer(on, config)
    },
  },
})
```

```shell
$ npx cypress run -- --env seed=1234567,randomizeFiles=false
```

Both spec-file order and block order are randomized by default.

Note that using Cypress's `--spec` flag will cause the **randomized file order to be bypassed**. To shuffle a selection of spec files, try using `--config specPattern="path/pattern/here/*"` instead.


## Options

| Option            | Type      | Default | Description                                 |
|-------------------|-----------|---------|---------------------------------------------|
| `randomizeFiles`  | `boolean` | `true`  | Randomize the order spec files are executed |
| `randomizeBlocks` | `boolean` | `true`  | Randomize `describe`/`it`/`test`/`context` blocks within each spec |
| `seed`            | `string`  | randomly-generated | Seed for the random number generator |

```javascript
definePlugin(on, config, {
  randomizeFiles:  true,      // shuffle spec files  (default: true)
  randomizeBlocks: true,      // shuffle describe/it blocks within each spec (default: true)
  seed:            undefined, // string | number — see Seeds * Reproducibility section below
})
```




## Seeds & Reproducibility

### Default behaviour — every run is different

When you don't provide a `seed`, the plugin generates a random one at the start of each run and prints it to the console:

```
[cypress-test-order-randomizer] Seed: a8f3c2d1b4e7
```

The tests are run in a shuffled order, and the order corresponds to the seed. The order of the tests can be recreated in later runs of the same tests by providing the same seed value.


### Reproducing a specific run

When a failure surfaces, copy the seed from the console and pass it back:

```typescript
return definePlugin(on, config, { seed: 'a8f3c2d1b4e7' })
```

Every subsequent run now uses that exact shuffle until you remove or change the `seed` option.

Note that if you are using something like cy-grep which adjust whether a given test is run or not, those settings may also need to be provided along with the seed to recreate a given scenario.


### Stable-but-rotating seeds for CI

If you want runs to be reproducible within a build but still rotate between builds, tie the seed to the build identifier:

```typescript
return definePlugin(on, config, {
  seed: process.env.CI_BUILD_ID,  // falls back to a random seed locally
})
```


### How a single seed controls both file order and block order

The global `seed` drives two independent shuffles:

| Shuffle | Derived seed | Scope |
|---|---|---|
| File order | `seed` directly | One shuffle of the full spec list |
| Block order (per spec) | `${seed}:${relativeFilePath}` | One shuffle per spec file, path is relative to project root so the seed is identical across environments |

Because block-level seeds include the file path, two spec files always receive *different* block shuffles from the same global seed — and those shuffles are stable and independent of how many files you have or what order they ran in.


### Disabling randomization without removing the plugin

```typescript
return definePlugin(on, config, {
  randomizeFiles: false,
  randomizeBlocks: false,
})
```

Useful for temporarily debugging an ordering issue without touching `cypress.config.ts` beyond one flag.


## How it works

1. **File order** — `definePlugin` resolves your `specPattern` globs with
   [`fast-glob`](https://github.com/mrmlnc/fast-glob), shuffles the resulting
   list using a seeded PRNG, and replaces `config.specPattern` with the ordered
   array before returning.

   > **`--spec` bypasses file-order shuffling.** When Cypress receives a `--spec`
   > argument on the command line, it resolves and runs those files directly,
   > ignoring `config.specPattern` entirely — so the plugin's shuffle never takes
   > effect. Block-order randomization (`randomizeBlocks`) still works regardless.
   >
   > If you want file-order shuffling when targeting a subset of specs, use
   > `--config specPattern=` instead:
   >
   > ```sh
   > # bypasses shuffle ✗
   > npx cypress run --spec "cypress/e2e/admin/*"
   >
   > # shuffles correctly ✓
   > npx cypress run --config specPattern="cypress/e2e/admin/*"
   > ```

2. **Block order** — A custom [esbuild](https://esbuild.github.io/) preprocessor
   intercepts each spec file before Cypress's test runner loads it. It parses the source
   with [`@babel/parser`](https://babeljs.io/docs/babel-parser), shuffles
   `describe`/`context`/`it`/`test`/`specify` blocks (and `.only`/`.skip`
   variants) at every nesting level while leaving hooks (`beforeEach`,
   `afterEach`, `before`, `after`), imports, and other statements in place, then
   regenerates the source and hands it to esbuild for bundling.

3. **Reproducibility** — The PRNG is a counter-mode SHA-256 construction built
   on Node.js's built-in `crypto` module. No hand-rolled math.


## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for local development setup, project layout, available scripts, and the maintainer release process.


## inspiration / prior art

This plugin stands on the shoulders of giants:

* the Vitest [`sequence.shuffle` and `sequence.seed` options](https://vitest.dev/config/sequence)

* [Bojan Dimitrovski, "Running Cypress Tests in Random Order"](https://prezi.com/p/xpa-hgs-fbyi/running-cypress-tests-in-random-order/)

* @mncharlton's [`/cypress-random-test-order`](https://github.com/mncharlton/cypress-random-test-order) (unmaintained as of 2021)

* [Cypress issue #2908: Allow for random spec ordering when running tests](https://github.com/cypress-io/cypress/issues/2908)

<details>
<summary>including @AlexandreRozier's [2024 implementation](https://github.com/cypress-io/cypress/issues/2908#issuecomment-2413306472) (inspired by @bahmutov's [@cypress/grep](https://github.com/cypress-io/cypress/blob/0e316966af3f281b3e297cae2d5f4c0c3054f8ed/npm/grep/src/plugin.js)):</summary>

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
