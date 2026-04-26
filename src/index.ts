import { randomBytes } from 'node:crypto'
import { resolveSpecFiles, randomizeSpecOrder } from './file-randomizer.js'
import { createPrng } from './seeded-random.js'
import { createPreprocessor } from './preprocessor.js'
import type { CypressPreprocessorFile } from './preprocessor.js'

export { transformCode } from './block-randomizer.js'
export type { CypressPreprocessorFile, PreprocessorOptions } from './preprocessor.js'

export interface PluginOptions {
  /**
   * Whether to randomize the order spec files are executed.
   * @default true
   */
  randomizeFiles?: boolean
  /**
   * Whether to randomize describe/it/test/context blocks within each spec.
   * @default true
   */
  randomizeBlocks?: boolean
  /**
   * Seed for the random number generator. Numbers are stringified, so `42`
   * and `'42'` produce identical shuffles.
   *
   * When omitted, a random seed is generated and printed to stdout so the
   * same run can be reproduced by passing it back as the `seed` option.
   */
  seed?: string | number
}

// Minimal Cypress plugin API shapes — we avoid importing from `cypress` itself
// so the peer dependency stays optional at TypeScript-compilation time.
// These are structurally compatible with Cypress.PluginEvents and
// Cypress.PluginConfigOptions respectively.
type CypressPluginOn = (event: string, handler: unknown) => void

interface CypressPluginConfig {
  specPattern?: string | string[]
  projectRoot?: string
}

/**
 * Registers the cypress-test-order-randomizer plugin with Cypress.
 *
 * Call this inside `setupNodeEvents` and return the result so Cypress picks
 * up the modified config:
 *
 * ```typescript
 * async setupNodeEvents(on, config) {
 *   return definePlugin(on, config)
 * }
 * ```
 */
export async function definePlugin(
  on: CypressPluginOn,
  config: CypressPluginConfig,
  options: PluginOptions = {}
): Promise<CypressPluginConfig> {
  const {
    randomizeFiles = true,
    randomizeBlocks = true,
    seed: providedSeed,
  } = options

  // Resolve or generate the seed and announce it so failed runs can be reproduced
  const seed = providedSeed !== undefined
    ? String(providedSeed)
    : randomBytes(6).toString('hex')

  process.stdout.write(`[cypress-test-order-randomizer] Seed: ${seed}\n`)

  if (randomizeFiles && config.specPattern !== undefined) {
    const cwd = config.projectRoot ?? process.cwd()
    const specFiles = await resolveSpecFiles(config.specPattern, cwd)
    config.specPattern = randomizeSpecOrder(specFiles, createPrng(seed))
  }

  if (randomizeBlocks) {
    on('file:preprocessor', createPreprocessor({ seed, randomizeBlocks: true }))
  }

  return config
}
