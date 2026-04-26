import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { createPrng } from '../src/seeded-random.js'
import { resolveSpecFiles, randomizeSpecOrder } from '../src/file-randomizer.js'

const SPEC_NAMES = ['alpha.cy.ts', 'beta.cy.ts', 'gamma.cy.ts', 'delta.cy.ts', 'epsilon.cy.ts']

let tempDir: string

beforeAll(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'ctr-file-randomizer-'))
  await Promise.all(
    SPEC_NAMES.map(name => writeFile(join(tempDir, name), `it('${name}', () => {})`))
  )
})

afterAll(async () => {
  await rm(tempDir, { recursive: true })
})

describe('resolveSpecFiles', () => {
  it('returns absolute paths for files matching the pattern', async () => {
    const files = await resolveSpecFiles('*.cy.ts', tempDir)
    expect(files.length).toBeGreaterThan(0)
    for (const file of files) {
      expect(file.startsWith('/')).toBe(true)
      expect(file.endsWith('.cy.ts')).toBe(true)
    }
  })

  it('returns all files matching the pattern', async () => {
    const files = await resolveSpecFiles('*.cy.ts', tempDir)
    expect(files).toHaveLength(SPEC_NAMES.length)
  })

  it('accepts an array of patterns and unions the results', async () => {
    const files = await resolveSpecFiles(['alpha.cy.ts', 'beta.cy.ts'], tempDir)
    expect(files).toHaveLength(2)
  })

  it('returns an empty array when no files match', async () => {
    const files = await resolveSpecFiles('*.cy.tsx', tempDir)
    expect(files).toEqual([])
  })

  it('returns paths in a stable sorted order so pre-shuffle order is deterministic', async () => {
    const run1 = await resolveSpecFiles('*.cy.ts', tempDir)
    const run2 = await resolveSpecFiles('*.cy.ts', tempDir)
    expect(run1).toEqual(run2)
    // Confirm they are actually sorted
    expect(run1).toEqual([...run1].toSorted())
  })
})

describe('randomizeSpecOrder', () => {
  it('returns a new array of the same length', () => {
    const files = ['/a.cy.ts', '/b.cy.ts', '/c.cy.ts']
    const result = randomizeSpecOrder(files, createPrng(42))
    expect(result).toHaveLength(files.length)
    expect(result).not.toBe(files)
  })

  it('contains all the same file paths', () => {
    const files = ['/a.cy.ts', '/b.cy.ts', '/c.cy.ts', '/d.cy.ts']
    const result = randomizeSpecOrder(files, createPrng(42))
    expect([...result].toSorted()).toEqual([...files].toSorted())
  })

  it('does not mutate the original array', () => {
    const files = ['/a.cy.ts', '/b.cy.ts', '/c.cy.ts']
    const snapshot = [...files]
    randomizeSpecOrder(files, createPrng(42))
    expect(files).toEqual(snapshot)
  })

  it('produces the same order for the same seed', () => {
    const files = ['/a.cy.ts', '/b.cy.ts', '/c.cy.ts', '/d.cy.ts', '/e.cy.ts']
    const result1 = randomizeSpecOrder(files, createPrng(99))
    const result2 = randomizeSpecOrder(files, createPrng(99))
    expect(result1).toEqual(result2)
  })

  it('produces different orders for different seeds', () => {
    // 13 items → 1/13! ≈ 1-in-6.2B chance of a false same-order result with any given pair of seeds
    const files = ['/a.cy.ts', '/b.cy.ts', '/c.cy.ts', '/d.cy.ts', '/e.cy.ts', '/f.cy.ts', '/g.cy.ts', '/h.cy.ts', '/i.cy.ts', '/j.cy.ts', '/k.cy.ts', '/l.cy.ts', '/m.cy.ts']
    const result1 = randomizeSpecOrder(files, createPrng(1))
    const result2 = randomizeSpecOrder(files, createPrng(2))
    expect(result1).not.toEqual(result2)
  })

  it('handles an empty file list', () => {
    expect(randomizeSpecOrder([], createPrng(42))).toEqual([])
  })

  it('handles a single-file list', () => {
    const files = ['/only.cy.ts']
    expect(randomizeSpecOrder(files, createPrng(42))).toEqual(files)
  })
})
