import { defineConfig } from 'cypress'
import { definePlugin } from '../../dist/index.js'

// This fixture config is used by test/e2e.test.ts.
// It imports from dist/ (the built output) so the e2e suite validates the same
// artefact that end-users install — not the raw TypeScript source.
// All plugin options (seed, randomizeFiles, randomizeBlocks) are passed in via
// --env flags from the test runner so this config never needs to change.
export default defineConfig({
  e2e: {
    specPattern: 'e2e/**/*.cy.ts?(x)',
    supportFile: false,
    video: false,
    screenshotOnRunFailure: false,
    // Prevents browser code from reading --env values via Cypress.env().
    // Plugin options in setupNodeEvents only need config.env (Node-side), not the browser side.
    allowCypressEnv: false,
    async setupNodeEvents(on, config) {
      return definePlugin(on, config)
    },
  },
})
