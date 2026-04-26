import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { definePlugin } from '../src/index.js'

/** Minimal shape of the Cypress config object that definePlugin reads and writes. */
interface MockConfig {
  specPattern: string | string[]
  projectRoot: string
}

function createMockConfig(overrides: Partial<MockConfig> = {}): MockConfig {
  return {
    specPattern: 'cypress/e2e/**/*.cy.ts',
    projectRoot: '/fake/project',
    ...overrides,
  }
}

describe('definePlugin', () => {
  let on: (event: string, handler: unknown) => void
  let stdoutSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    on = vi.fn<(event: string, handler: unknown) => void>()
    // Suppress stdout for all tests to prevent seed lines from bleeding into
    // concurrent test output from other files
    stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
  })

  afterEach(() => {
    stdoutSpy.mockRestore()
  })

  it('returns the config object', async () => {
    const config = createMockConfig()
    const result = await definePlugin(on, config)
    expect(result).toBe(config)
  })

  it('registers a file:preprocessor handler', async () => {
    const config = createMockConfig()
    await definePlugin(on, config)
    expect(on).toHaveBeenCalledWith('file:preprocessor', expect.any(Function))
  })

  it('accepts options with randomizeFiles and randomizeBlocks', async () => {
    const config = createMockConfig()
    await expect(
      definePlugin(on, config, { randomizeFiles: false, randomizeBlocks: false })
    ).resolves.toBeDefined()
  })

  it('prints the seed to stdout', async () => {
    const config = createMockConfig()
    await definePlugin(on, config, { seed: 'test-seed-123' })
    expect(stdoutSpy).toHaveBeenCalledWith(
      expect.stringContaining('test-seed-123')
    )
  })

  it('uses a provided seed without throwing', async () => {
    const config = createMockConfig()
    await expect(definePlugin(on, config, { seed: 42 })).resolves.toBeDefined()
    await expect(definePlugin(on, config, { seed: 'my-seed' })).resolves.toBeDefined()
  })

  it('generates a seed when none is provided', async () => {
    const config = createMockConfig()
    await definePlugin(on, config)
    // Some seed should have been printed
    expect(stdoutSpy).toHaveBeenCalledWith(expect.stringMatching(/\[cypress-test-order-randomizer\] Seed:/))
  })

  it('does not register a file:preprocessor when randomizeBlocks is false', async () => {
    const config = createMockConfig()
    await definePlugin(on, config, { randomizeBlocks: false })
    expect(on).not.toHaveBeenCalledWith('file:preprocessor', expect.any(Function))
  })

  it('re-exports transformCode for advanced use', async () => {
    const { transformCode } = await import('../src/index.js')
    expect(typeof transformCode).toBe('function')
  })
})
