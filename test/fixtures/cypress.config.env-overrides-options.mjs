// Fixture config used by the "env overrides programmatic options" e2e scenario.

// The app code options sets randomizeBlocks: false, but the test runner passes
// --env randomizeBlocks=true,seed=42 which must take priority.

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
      return definePlugin(on, config, { seed: '42', randomizeBlocks: false })
    },
  },
})
