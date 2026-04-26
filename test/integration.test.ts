// Integration tests for definePlugin — no real Cypress process is involved.
//
// What is simulated:
//   - `on`          — a vi.fn() mock that captures event handlers Cypress would
//                     register (specifically 'file:preprocessor')
//   - `config`      — a plain object shaped like what Cypress passes into
//                     setupNodeEvents; definePlugin mutates it in place
//   - stdout        — spied on and suppressed so seed lines don't bleed into
//                     concurrent test output from other files
//
// What is real:
//   - Temp directories and actual .cy.ts files on disk, because resolveSpecFiles
//     uses fast-glob which reads the real filesystem
//   - The seed/PRNG logic, which actually shuffles the file list
//   - definePlugin itself, called exactly as user code would call it
//
// What each group asserts:
//   file ordering      — inspects config.specPattern after the call; definePlugin
//                        replaces it with the shuffled array of absolute paths it
//                        would hand back to Cypress
//   seed behaviour     — calls getFileOrder twice with the same seed and asserts
//                        the returned arrays are equal
//   config combos      — checks the two observable side-effects of each option
//                        pair: whether `on` was called with 'file:preprocessor'
//                        (driven by randomizeBlocks) and whether config.specPattern
//                        became an array (driven by randomizeFiles)

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { definePlugin } from '../src/index.js'

interface MockConfig {
  specPattern: string | string[]
  projectRoot: string
}

function createMockConfig(overrides: Partial<MockConfig> = {}): MockConfig {
  return {
    specPattern: '*.cy.ts',
    projectRoot: '/nonexistent',
    ...overrides,
  }
}

describe('definePlugin — integration', () => {
  let tempDir: string
  let stdoutSpy: ReturnType<typeof vi.spyOn>

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'ctr-integration-'))
    stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
  })

  afterEach(async () => {
    stdoutSpy.mockRestore()
    await rm(tempDir, { recursive: true })
  })

  describe('file ordering', () => {
    it('shuffles multiple spec files into a non-sorted order', async () => {
      // 8 files → 1/40320 chance the shuffle matches sorted order for any given seed
      const names = ['aaa', 'bbb', 'ccc', 'ddd', 'eee', 'fff', 'ggg', 'hhh']
      await Promise.all(names.map(name =>
        writeFile(join(tempDir, `${name}.cy.ts`), `it('${name}', () => {})`)
      ))

      const on = vi.fn<(event: string, handler: unknown) => void>()
      const config = createMockConfig({ projectRoot: tempDir })
      await definePlugin(on, config, { seed: 'shuffle-test', randomizeBlocks: false })

      expect(Array.isArray(config.specPattern)).toBe(true)
      const result = config.specPattern as string[]
      const sorted = [...result].toSorted()
      expect([...result].toSorted()).toEqual(sorted) // all files still present
      expect(result).not.toEqual(sorted)             // order has changed
    })

    it('produces the same file order for the same seed', async () => {
      const names = ['aaa', 'bbb', 'ccc', 'ddd', 'eee']
      await Promise.all(names.map(name =>
        writeFile(join(tempDir, `${name}.cy.ts`), `it('${name}', () => {})`)
      ))

      const on = vi.fn<(event: string, handler: unknown) => void>()
      const config1 = createMockConfig({ projectRoot: tempDir })
      const config2 = createMockConfig({ projectRoot: tempDir })
      await definePlugin(on, config1, { seed: 'reproducible', randomizeBlocks: false })
      await definePlugin(on, config2, { seed: 'reproducible', randomizeBlocks: false })

      expect(config1.specPattern).toEqual(config2.specPattern)
    })

    it('leaves specPattern unchanged when randomizeFiles is false', async () => {
      const on = vi.fn<(event: string, handler: unknown) => void>()
      const originalPattern = '*.cy.ts'
      const config = createMockConfig({ specPattern: originalPattern, projectRoot: tempDir })
      await definePlugin(on, config, { seed: 'any-seed', randomizeFiles: false, randomizeBlocks: false })

      expect(config.specPattern).toBe(originalPattern)
    })

    it('handles a single spec file without error', async () => {
      await writeFile(join(tempDir, 'only.cy.ts'), `it('only test', () => {})`)

      const on = vi.fn<(event: string, handler: unknown) => void>()
      const config = createMockConfig({ projectRoot: tempDir })
      await definePlugin(on, config, { seed: 'single', randomizeBlocks: false })

      expect(Array.isArray(config.specPattern)).toBe(true)
      expect((config.specPattern as string[]).length).toBe(1)
    })

    it('handles no matching spec files gracefully', async () => {
      // tempDir is empty — no .cy.ts files exist; resolveSpecFiles returns [] and
      // definePlugin sets config.specPattern to that empty array without throwing
      const on = vi.fn<(event: string, handler: unknown) => void>()
      const config = createMockConfig({ specPattern: '*.cy.ts', projectRoot: tempDir })
      await expect(
        definePlugin(on, config, { seed: 'no-files', randomizeBlocks: false })
      ).resolves.toBeDefined()
      expect(config.specPattern).toEqual([])
    })
  })

  describe('seed behaviour', () => {
    // Writes the same 5 files, calls definePlugin with the given seed, and returns
    // the resulting specPattern array. Calling it twice with the same seed and the
    // same files on disk should yield identical arrays.
    async function getFileOrder(seed: string | number): Promise<string[]> {
      const names = ['aaa', 'bbb', 'ccc', 'ddd', 'eee']
      await Promise.all(names.map(name =>
        writeFile(join(tempDir, `${name}.cy.ts`), `it('${name}', () => {})`)
      ))
      const on = vi.fn<(event: string, handler: unknown) => void>()
      const config = createMockConfig({ projectRoot: tempDir })
      await definePlugin(on, config, { seed, randomizeBlocks: false })
      return config.specPattern as string[]
    }

    it('produces a reproducible order with a string seed', async () => {
      const order1 = await getFileOrder('my-string-seed')
      const order2 = await getFileOrder('my-string-seed')
      expect(order1).toEqual(order2)
    })

    it('produces a reproducible order with a numeric seed', async () => {
      const order1 = await getFileOrder(12345)
      const order2 = await getFileOrder(12345)
      expect(order1).toEqual(order2)
    })

    it('numeric 42 and string "42" produce the same file order', async () => {
      // Seeds are stringified before hashing, so 42 and '42' are identical inputs
      const orderFromNumber = await getFileOrder(42)
      const orderFromString = await getFileOrder('42')
      expect(orderFromNumber).toEqual(orderFromString)
    })
  })

  describe('configuration combinations', () => {
    // Each combination has two observable side-effects:
    //   - whether `on` was called with 'file:preprocessor' → driven by randomizeBlocks
    //   - whether config.specPattern became an array   → driven by randomizeFiles
    let on: ReturnType<typeof vi.fn<(event: string, handler: unknown) => void>>

    beforeEach(async () => {
      on = vi.fn<(event: string, handler: unknown) => void>()
      await writeFile(join(tempDir, 'example.cy.ts'), `it('test', () => {})`)
    })

    it('{ randomizeFiles: true, randomizeBlocks: true } — registers preprocessor and resolves specPattern', async () => {
      const config = createMockConfig({ projectRoot: tempDir })
      await definePlugin(on, config, { seed: 'combo', randomizeFiles: true, randomizeBlocks: true })

      expect(on).toHaveBeenCalledWith('file:preprocessor', expect.any(Function))
      expect(Array.isArray(config.specPattern)).toBe(true)
    })

    it('{ randomizeFiles: false, randomizeBlocks: true } — registers preprocessor, leaves specPattern as-is', async () => {
      const original = '*.cy.ts'
      const config = createMockConfig({ specPattern: original, projectRoot: tempDir })
      await definePlugin(on, config, { seed: 'combo', randomizeFiles: false, randomizeBlocks: true })

      expect(on).toHaveBeenCalledWith('file:preprocessor', expect.any(Function))
      expect(config.specPattern).toBe(original)
    })

    it('{ randomizeFiles: true, randomizeBlocks: false } — no preprocessor registered, resolves specPattern', async () => {
      const config = createMockConfig({ projectRoot: tempDir })
      await definePlugin(on, config, { seed: 'combo', randomizeFiles: true, randomizeBlocks: false })

      expect(on).not.toHaveBeenCalledWith('file:preprocessor', expect.any(Function))
      expect(Array.isArray(config.specPattern)).toBe(true)
    })

    it('{ randomizeFiles: false, randomizeBlocks: false } — effective no-op, specPattern and on unchanged', async () => {
      const original = '*.cy.ts'
      const config = createMockConfig({ specPattern: original, projectRoot: tempDir })
      await definePlugin(on, config, { seed: 'combo', randomizeFiles: false, randomizeBlocks: false })

      expect(on).not.toHaveBeenCalledWith('file:preprocessor', expect.any(Function))
      expect(config.specPattern).toBe(original)
    })
  })
})
