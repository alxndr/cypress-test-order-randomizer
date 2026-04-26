import { describe, it, expect } from 'vitest'
import { createPrng, shuffleArray } from '../src/seeded-random.js'

describe('createPrng', () => {
  it('returns a function', () => {
    expect(typeof createPrng(42)).toBe('function')
    expect(typeof createPrng('my-seed')).toBe('function')
  })

  it('returns values in [0, 1)', () => {
    const prng = createPrng(42)
    for (let i = 0; i < 100; i++) {
      const value = prng()
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThan(1)
    }
  })

  it('produces the same sequence for the same numeric seed', () => {
    const prng1 = createPrng(12345)
    const prng2 = createPrng(12345)
    for (let i = 0; i < 20; i++) {
      expect(prng1()).toBe(prng2())
    }
  })

  it('produces the same sequence for the same string seed', () => {
    const prng1 = createPrng('my-test-run')
    const prng2 = createPrng('my-test-run')
    for (let i = 0; i < 20; i++) {
      expect(prng1()).toBe(prng2())
    }
  })

  it('treats a numeric seed and its string equivalent as the same seed', () => {
    // String(42) === '42', so both should produce identical sequences
    const sequence1 = Array.from({ length: 10 }, createPrng(42))
    const sequence2 = Array.from({ length: 10 }, createPrng('42'))
    expect(sequence1).toEqual(sequence2)
  })

  it('produces different sequences for different seeds', () => {
    const sequence1 = Array.from({ length: 20 }, createPrng(1))
    const sequence2 = Array.from({ length: 20 }, createPrng(2))
    expect(sequence1).not.toEqual(sequence2)
  })
})

describe('shuffleArray', () => {
  it('returns a new array of the same length', () => {
    const input = [1, 2, 3, 4, 5]
    const result = shuffleArray(input, createPrng(42))
    expect(result).toHaveLength(input.length)
    expect(result).not.toBe(input)
  })

  it('contains all the same elements as the input', () => {
    const input = ['a', 'b', 'c', 'd', 'e']
    const result = shuffleArray(input, createPrng(42))
    expect([...result].toSorted()).toEqual([...input].toSorted())
  })

  it('does not mutate the original array', () => {
    const input = [1, 2, 3, 4, 5]
    const snapshot = [...input]
    shuffleArray(input, createPrng(42))
    expect(input).toEqual(snapshot)
  })

  it('produces the same shuffle for the same seed', () => {
    const input = [1, 2, 3, 4, 5, 6, 7, 8]
    const result1 = shuffleArray(input, createPrng(999))
    const result2 = shuffleArray(input, createPrng(999))
    expect(result1).toEqual(result2)
  })

  it('produces different shuffles for different seeds', () => {
    const input = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
    const result1 = shuffleArray(input, createPrng(1))
    const result2 = shuffleArray(input, createPrng(2))
    expect(result1).not.toEqual(result2)
  })

  it('handles an empty array', () => {
    expect(shuffleArray([], createPrng(42))).toEqual([])
  })

  it('handles a single-element array', () => {
    expect(shuffleArray(['only'], createPrng(42))).toEqual(['only'])
  })
})
