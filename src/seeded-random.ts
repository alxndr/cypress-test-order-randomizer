import { createHash } from 'node:crypto'

/**
 * Counter-mode SHA-256 PRNG — produces a deterministic sequence of floats
 * in [0, 1) from a seed. Uses Node.js crypto so there's no hand-rolled
 * algorithm to maintain. Accepts string or number; both are stringified
 * so createPrng(42) and createPrng('42') produce the same sequence.
 */
export function createPrng(seed: string | number): () => number {
  const seedString = String(seed)
  let counter = 0
  return function nextRandom(): number {
    const digest = createHash('sha256')
      .update(`${seedString}:${counter++}`)
      .digest()
    return digest.readUInt32BE(0) / 0x100000000
  }
}

/**
 * Fisher-Yates shuffle — returns a new array with elements in a randomized
 * order determined by randomFn. Does not mutate the input array.
 */
export function shuffleArray<T>(arr: readonly T[], randomFn: () => number): T[] {
  const result = [...arr]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(randomFn() * (i + 1))
    // Both indices are always in bounds: i < length, j <= i
    const temp = result[i] as T
    result[i] = result[j] as T
    result[j] = temp
  }
  return result
}
