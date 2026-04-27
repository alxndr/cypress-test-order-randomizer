// Fixture config used by the "env overrides programmatic options" e2e scenario.

// All plugin options (seed, randomizeFiles, randomizeBlocks) are passed in via
// --env flags from the test runner so this config never needs to change.

import { defineConfig } from 'cypress'
import { definePlugin } from '../../dist/index.js'

export default defineConfig({
  e2e: {
    specPattern: 'e2e/**/*.cy.ts?(x)',
    supportFile: false,
    video: false,
    screenshotOnRunFailure: false,
    allowCypressEnv: false,
    async setupNodeEvents(on, config) {
      return definePlugin(on, config)
    },
  },
})
