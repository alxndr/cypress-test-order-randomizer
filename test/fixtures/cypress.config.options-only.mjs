// Fixture config used by the "programmatic options (no --env)" e2e scenario.
// All plugin options are supplied via the third argument to definePlugin rather
// than via --env, verifying that the options path works independently.
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
