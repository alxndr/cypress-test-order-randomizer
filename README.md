# cypress-test-order-randomizer

Like it says on the tin. 🥫


## inspiration

This plugin stands on the shoulders of giants:

* [Bojan Dimitrovski, "Running Cypress Tests in Random Order"](https://prezi.com/p/xpa-hgs-fbyi/running-cypress-tests-in-random-order/)

* @mncharlton's [`/cypress-random-test-order`](https://github.com/mncharlton/cypress-random-test-order) (unmaintained as of 2021)

* [Cypress issue #2908: Allow for random spec ordering when running tests](https://github.com/cypress-io/cypress/issues/2908)

<details>
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
