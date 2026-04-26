import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { EventEmitter } from 'node:events'
import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { createPreprocessor } from '../src/preprocessor.js'
import type { CypressPreprocessorFile } from '../src/preprocessor.js'

function createMockFile(filePath: string, outputPath: string, shouldWatch = false): CypressPreprocessorFile {
  const file = new EventEmitter() as CypressPreprocessorFile
  file.filePath = filePath
  file.outputPath = outputPath
  file.shouldWatch = shouldWatch
  return file
}

/** Finds the positions of test-name strings in bundled output to check ordering. */
function orderOf(names: string[], output: string): number[] {
  return names.map(name => output.search(new RegExp(`["'\`]${name}["'\`]`)))
}

describe('createPreprocessor', () => {
  let tempDir: string

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'ctr-preprocessor-'))
  })

  afterEach(async () => {
    await rm(tempDir, { recursive: true })
  })

  it('returns a function', () => {
    const handler = createPreprocessor({ seed: 42, randomizeBlocks: true })
    expect(typeof handler).toBe('function')
  })

  it('returns a Promise that resolves to outputPath', async () => {
    const specPath = join(tempDir, 'example.cy.ts')
    const outputPath = join(tempDir, 'example.cy.js')
    await writeFile(specPath, `it('test', () => {})`)

    const handler = createPreprocessor({ seed: 42, randomizeBlocks: true })
    const result = await handler(createMockFile(specPath, outputPath))
    expect(result).toBe(outputPath)
  })

  it('writes a non-empty bundled file to outputPath', async () => {
    const specPath = join(tempDir, 'example.cy.ts')
    const outputPath = join(tempDir, 'example.cy.js')
    await writeFile(specPath, `it('test', () => {})`)

    await createPreprocessor({ seed: 42, randomizeBlocks: true })(createMockFile(specPath, outputPath))

    const output = await readFile(outputPath, 'utf-8')
    expect(output.length).toBeGreaterThan(0)
  })

  it('output contains all the original test names', async () => {
    const specPath = join(tempDir, 'names.cy.ts')
    const outputPath = join(tempDir, 'names.cy.js')
    await writeFile(specPath, `
      describe('my suite', () => {
        it('test A', () => {})
        it('test B', () => {})
        it('test C', () => {})
      })
    `)

    await createPreprocessor({ seed: 42, randomizeBlocks: true })(createMockFile(specPath, outputPath))

    const output = await readFile(outputPath, 'utf-8')
    expect(output).toContain('test A')
    expect(output).toContain('test B')
    expect(output).toContain('test C')
    expect(output).toContain('my suite')
  })

  it('different seeds produce different block orders', async () => {
    const specContent = `
      describe('suite', () => {
        it('A', () => {})
        it('B', () => {})
        it('C', () => {})
        it('D', () => {})
        it('E', () => {})
        it('F', () => {})
      })
    `
    const spec1 = join(tempDir, 'seed1.cy.ts')
    const spec2 = join(tempDir, 'seed2.cy.ts')
    const out1 = join(tempDir, 'seed1.cy.js')
    const out2 = join(tempDir, 'seed2.cy.js')
    await writeFile(spec1, specContent)
    await writeFile(spec2, specContent)

    await createPreprocessor({ seed: 1, randomizeBlocks: true })(createMockFile(spec1, out1))
    await createPreprocessor({ seed: 2, randomizeBlocks: true })(createMockFile(spec2, out2))

    const output1 = await readFile(out1, 'utf-8')
    const output2 = await readFile(out2, 'utf-8')
    expect(output1).not.toBe(output2)
  })

  it('same seed produces the same block order', async () => {
    // Both runs use the same filePath so the PRNG seed (${seed}:${filePath}) is
    // identical, guaranteeing the same shuffle. Different outputPaths let us
    // capture each run's result independently.
    const specPath = join(tempDir, 'reproducible.cy.ts')
    const out1 = join(tempDir, 'run1.cy.js')
    const out2 = join(tempDir, 'run2.cy.js')
    await writeFile(specPath, `
      describe('suite', () => {
        it('A', () => {})
        it('B', () => {})
        it('C', () => {})
        it('D', () => {})
        it('E', () => {})
      })
    `)

    await createPreprocessor({ seed: 99, randomizeBlocks: true })(createMockFile(specPath, out1))
    await createPreprocessor({ seed: 99, randomizeBlocks: true })(createMockFile(specPath, out2))

    const output1 = await readFile(out1, 'utf-8')
    const output2 = await readFile(out2, 'utf-8')
    expect(output1).toBe(output2)
  })

  it('preserves original it block order when randomizeBlocks is false', async () => {
    const specPath = join(tempDir, 'ordered.cy.ts')
    const outputPath = join(tempDir, 'ordered.cy.js')
    await writeFile(specPath, `
      describe('suite', () => {
        it('A', () => {})
        it('B', () => {})
        it('C', () => {})
        it('D', () => {})
        it('E', () => {})
      })
    `)

    await createPreprocessor({ seed: 42, randomizeBlocks: false })(createMockFile(specPath, outputPath))

    const output = await readFile(outputPath, 'utf-8')
    const positions = orderOf(['A', 'B', 'C', 'D', 'E'], output)
    for (let i = 0; i < positions.length - 1; i++) {
      expect(positions[i]).toBeLessThan(positions[i + 1]!)
    }
  })

  it('emitting close does not throw', async () => {
    const specPath = join(tempDir, 'close.cy.ts')
    const outputPath = join(tempDir, 'close.cy.js')
    await writeFile(specPath, `it('test', () => {})`)

    const file = createMockFile(specPath, outputPath)
    await createPreprocessor({ seed: 42, randomizeBlocks: true })(file)
    expect(() => file.emit('close')).not.toThrow()
  })

  it('handles a TypeScript spec with type annotations', async () => {
    const specPath = join(tempDir, 'typed.cy.ts')
    const outputPath = join(tempDir, 'typed.cy.js')
    await writeFile(specPath, `
      const greet = (name: string): string => \`Hello, \${name}!\`
      describe('typed suite', () => {
        it('typed test', () => {})
      })
    `)

    const handler = createPreprocessor({ seed: 42, randomizeBlocks: true })
    await expect(handler(createMockFile(specPath, outputPath))).resolves.toBe(outputPath)

    const output = await readFile(outputPath, 'utf-8')
    expect(output).toContain('typed suite')
    expect(output).toContain('typed test')
  })

  it('handles a JSX spec (.cy.tsx)', async () => {
    const specPath = join(tempDir, 'component.cy.tsx')
    const outputPath = join(tempDir, 'component.cy.js')
    // esbuild transforms JSX to React.createElement by default; React doesn't need
    // to be installed for the build to succeed — it's treated as a global reference
    await writeFile(specPath, `
      describe('jsx suite', () => {
        it('renders an element', () => {
          const el = <div className="test" />
        })
      })
    `)

    const handler = createPreprocessor({ seed: 42, randomizeBlocks: true })
    await expect(handler(createMockFile(specPath, outputPath))).resolves.toBe(outputPath)

    const output = await readFile(outputPath, 'utf-8')
    expect(output).toContain('jsx suite')
    expect(output).toContain('renders an element')
  })

  it('resolves relative imports and inlines them into the bundle', async () => {
    const helperPath = join(tempDir, 'helpers.ts')
    const specPath = join(tempDir, 'uses-helpers.cy.ts')
    const outputPath = join(tempDir, 'uses-helpers.cy.js')

    await writeFile(helperPath, `export const MARKER = 'helper-was-bundled'`)
    await writeFile(specPath, `
      import { MARKER } from './helpers'
      describe('imports suite', () => {
        it('uses the helper', () => { console.log(MARKER) })
      })
    `)

    const handler = createPreprocessor({ seed: 42, randomizeBlocks: true })
    await expect(handler(createMockFile(specPath, outputPath))).resolves.toBe(outputPath)

    const output = await readFile(outputPath, 'utf-8')
    expect(output).toContain('helper-was-bundled')
    expect(output).toContain('imports suite')
  })

  it('handles an empty describe body without crashing', async () => {
    const specPath = join(tempDir, 'empty-describe.cy.ts')
    const outputPath = join(tempDir, 'empty-describe.cy.js')
    await writeFile(specPath, `describe('empty suite', () => {})`)

    const handler = createPreprocessor({ seed: 42, randomizeBlocks: true })
    await expect(handler(createMockFile(specPath, outputPath))).resolves.toBe(outputPath)

    const output = await readFile(outputPath, 'utf-8')
    expect(output).toContain('empty suite')
  })
})
