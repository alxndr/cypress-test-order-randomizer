// fast-glob is CJS-only and assigns its named exports (`glob`, `async`, etc.)
// as properties on the default-exported function rather than via static
// `exports.foo = …` assignments, so Node's ESM loader can't see them as named
// exports — only the default import is reliably detected. Cypress <15.17 ran
// config files through a bundler that papered over this; 15.17+ loads them
// under stricter, closer-to-native ESM, so a named import here breaks plugin
// consumers on newer Cypress versions.
import fastGlob from 'fast-glob'
import { shuffleArray } from './seeded-random.js'

/**
 * Resolves a Cypress specPattern (string or string[]) to an array of absolute
 * file paths, sorted lexicographically so that the pre-shuffle order is
 * deterministic regardless of filesystem traversal order.
 */
export async function resolveSpecFiles(
  specPattern: string | string[],
  cwd: string
): Promise<string[]> {
  const patterns = Array.isArray(specPattern) ? specPattern : [specPattern]
  const files = await fastGlob(patterns, { cwd, absolute: true })
  return files.toSorted()
}

/**
 * Returns a new array of file paths in a randomized order determined by
 * randomFn. Does not mutate the input array.
 */
export function randomizeSpecOrder(files: string[], randomFn: () => number): string[] {
  return shuffleArray(files, randomFn)
}
