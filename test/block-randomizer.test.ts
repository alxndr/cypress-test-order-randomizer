import { describe, it, expect } from 'vitest'
import { createPrng } from '../src/seeded-random.js'
import { transformCode } from '../src/block-randomizer.js'

/** Extracts it/test/specify names in source order (handles it, it.only, it.skip, etc.) */
function extractTestNames(code: string): string[] {
  return [...code.matchAll(/\b(?:it|test|specify)(?:\.only|\.skip)?\s*\(\s*['"`]([^'"`\n]+)['"`]/g)]
    .map(match => match[1]!)
}

describe('transformCode', () => {
  it('returns a string', () => {
    expect(typeof transformCode(`it('test', () => {})`, createPrng(1))).toBe('string')
  })

  it('contains all the original test names after transformation', () => {
    const code = `
      describe('suite', () => {
        it('test A', () => {})
        it('test B', () => {})
        it('test C', () => {})
      })
    `
    const result = transformCode(code, createPrng(42))
    const names = extractTestNames(result)
    expect(names).toHaveLength(3)
    expect(names).toContain('test A')
    expect(names).toContain('test B')
    expect(names).toContain('test C')
  })

  it('produces the same output for the same seed', () => {
    const code = `
      describe('suite', () => {
        it('A', () => {})
        it('B', () => {})
        it('C', () => {})
        it('D', () => {})
        it('E', () => {})
      })
    `
    expect(transformCode(code, createPrng(42))).toBe(transformCode(code, createPrng(42)))
  })

  it('produces different outputs for different seeds', () => {
    const code = `
      describe('suite', () => {
        it('A', () => {})
        it('B', () => {})
        it('C', () => {})
        it('D', () => {})
        it('E', () => {})
        it('F', () => {})
      })
    `
    expect(transformCode(code, createPrng(1))).not.toBe(transformCode(code, createPrng(2)))
  })

  it('reorders the it blocks within a describe', () => {
    // 8 items → 1/40320 chance of preserving order with any given seed
    const code = `
      describe('suite', () => {
        it('A', () => {})
        it('B', () => {})
        it('C', () => {})
        it('D', () => {})
        it('E', () => {})
        it('F', () => {})
        it('G', () => {})
        it('H', () => {})
      })
    `
    const result = transformCode(code, createPrng(1))
    const outputOrder = extractTestNames(result)
    expect(outputOrder).not.toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'])
    expect([...outputOrder].toSorted()).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'])
  })

  it('preserves non-test statements (hooks, variables, imports)', () => {
    const code = `
      import { something } from './helpers'
      describe('suite', () => {
        const helper = () => {}
        beforeEach(() => { cy.visit('/') })
        it('A', () => {})
        it('B', () => {})
        afterEach(() => {})
      })
    `
    const result = transformCode(code, createPrng(42))
    expect(result).toContain('beforeEach')
    expect(result).toContain('afterEach')
    expect(result).toContain('const helper')
    expect(result).toContain("'A'")
    expect(result).toContain("'B'")
  })

  it('preserves hook positions relative to the statement list', () => {
    const code = `
      describe('suite', () => {
        beforeEach(() => {})
        it('A', () => {})
        it('B', () => {})
        it('C', () => {})
        afterEach(() => {})
      })
    `
    const result = transformCode(code, createPrng(42))
    const beforeEachIdx = result.indexOf('beforeEach')
    const afterEachIdx = result.indexOf('afterEach')
    const firstTestIdx = result.search(/\bit\s*\(/)
    const lastTestIdx = result.lastIndexOf('it(')
    expect(beforeEachIdx).toBeLessThan(firstTestIdx)
    expect(afterEachIdx).toBeGreaterThan(lastTestIdx)
  })

  it('recursively shuffles it blocks inside nested describe blocks', () => {
    const code = `
      describe('outer', () => {
        describe('inner', () => {
          it('nested A', () => {})
          it('nested B', () => {})
          it('nested C', () => {})
          it('nested D', () => {})
          it('nested E', () => {})
          it('nested F', () => {})
          it('nested G', () => {})
          it('nested H', () => {})
        })
      })
    `
    const inputOrder = ['nested A', 'nested B', 'nested C', 'nested D', 'nested E', 'nested F', 'nested G', 'nested H']
    const result = transformCode(code, createPrng(1))
    const outputOrder = extractTestNames(result)
    expect([...outputOrder].toSorted()).toEqual([...inputOrder].toSorted())
    expect(outputOrder).not.toEqual(inputOrder)
  })

  it('handles describe.only, context, it.skip, and other variants', () => {
    const code = `
      describe.only('suite', () => {
        it.skip('A', () => {})
        it.only('B', () => {})
        it('C', () => {})
        it('D', () => {})
      })
    `
    const result = transformCode(code, createPrng(42))
    expect(result).toContain('describe.only')
    expect(result).toContain('it.skip')
    expect(result).toContain('it.only')
    const names = extractTestNames(result)
    expect(names).toHaveLength(4)
    expect(names).toContain('A')
    expect(names).toContain('B')
    expect(names).toContain('C')
    expect(names).toContain('D')
  })

  it('handles a spec with no test blocks without errors', () => {
    const code = `const x = 1\nexport default x`
    expect(() => transformCode(code, createPrng(42))).not.toThrow()
    const result = transformCode(code, createPrng(42))
    expect(result).toContain('const x = 1')
    expect(result).toContain('export default x')
  })

  it('handles TypeScript syntax', () => {
    const code = `
      const setup = (): void => { cy.visit('/') }
      describe('suite', () => {
        it('A', () => {})
        it('B', () => {})
        it('C', () => {})
      })
    `
    expect(() => transformCode(code, createPrng(42))).not.toThrow()
    const names = extractTestNames(transformCode(code, createPrng(42)))
    expect(names).toContain('A')
    expect(names).toContain('B')
    expect(names).toContain('C')
  })
})
