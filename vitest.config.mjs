import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    sequence: {
      shuffle: true, // Vitest shuffle — both test files and tests within each file (e.g. what we are porting to Cypress with this plugin)
    },
  },
})
