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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CypressPluginOn = (event: any, handler: any) => void

interface CypressPluginConfig {
  specPattern?: string | string[]
  projectRoot?: string
  // Populated by --env flags on the CLI and the env: block in cypress.config.ts.
  // We read plugin options from here so users can override without editing config.
  env?: Record<string, unknown>
}

// Returns the boolean value of a key in config.env, with coercion from the
// string 'false' that --env flags always produce. Returns undefined when absent.
function readBoolEnv(env: Record<string, unknown> | undefined, key: string): boolean | undefined {
  const value = env?.[key]
  if (value === undefined || value === null) return undefined
  if (typeof value === 'boolean') return value
  return String(value) !== 'false'
}

// Returns a non-empty string value from config.env, or undefined when absent.
function readStringEnv(env: Record<string, unknown> | undefined, key: string): string | undefined {
  const value = env?.[key]
  if (value === undefined || value === null) return undefined
  const str = String(value)
  return str.length > 0 ? str : undefined
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
 *
 * All three options can also be set or overridden at run time via Cypress's
 * `--env` flag (highest priority), which takes precedence over the `options`
 * argument (project-level defaults):
 *
 * ```
 * npx cypress run --env seed=42,randomizeBlocks=false
 * ```
 */
export async function definePlugin<T extends CypressPluginConfig>(
  on: CypressPluginOn,
  config: T,
  options: PluginOptions = {}
): Promise<T> {
  const env = config.env

  // Priority: config.env (--env flags, always wins) > options (project default) > built-in defaults
  const randomizeFiles = readBoolEnv(env, 'randomizeFiles') ?? options.randomizeFiles ?? true
  const randomizeBlocks = readBoolEnv(env, 'randomizeBlocks') ?? options.randomizeBlocks ?? true
  const seed =
    readStringEnv(env, 'seed') ??
    (options.seed !== undefined ? String(options.seed) : undefined) ??
    randomBytes(6).toString('hex')

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
