import { glob } from 'node:fs/promises'
import { resolve } from 'node:path'
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
  // node:fs/promises glob() yields paths relative to cwd, with no built-in
  // "absolute" option — resolve them ourselves.
  const files = await Array.fromAsync(glob(patterns, { cwd }), (file) => resolve(cwd, file))
  return files.toSorted()
}

/**
 * Returns a new array of file paths in a randomized order determined by
 * randomFn. Does not mutate the input array.
 */
export function randomizeSpecOrder(files: string[], randomFn: () => number): string[] {
  return shuffleArray(files, randomFn)
}
