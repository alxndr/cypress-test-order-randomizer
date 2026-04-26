import { parse } from '@babel/parser'
import _generate from '@babel/generator'
import type {
  Node,
  Statement,
  ExpressionStatement,
  CallExpression,
  ArrowFunctionExpression,
  FunctionExpression,
} from '@babel/types'
import { shuffleArray } from './seeded-random.js'

// @babel/generator ships CJS with exports.default = generate. In an ESM context
// (native Node.js or compiled output) the default import wraps module.exports, so
// we have to unwrap .default ourselves to get the actual function.
const generate = ((_generate as unknown as { default: typeof _generate }).default) ?? _generate

// Cypress/Mocha functions that open a new nested scope
const DESCRIBE_LIKE_NAMES = new Set([
  'describe', 'context',
  'describe.only', 'describe.skip',
  'context.only', 'context.skip',
])

// Cypress/Mocha leaf test functions
const IT_LIKE_NAMES = new Set([
  'it', 'test', 'specify',
  'it.only', 'it.skip',
  'test.only', 'test.skip',
  'specify.only', 'specify.skip',
])

function getCallName(node: Node): string | null {
  if (node.type !== 'ExpressionStatement') return null
  const { expression } = node as ExpressionStatement
  if (expression.type !== 'CallExpression') return null
  const { callee } = expression as CallExpression
  if (callee.type === 'Identifier') return callee.name
  if (
    callee.type === 'MemberExpression' &&
    !callee.computed &&
    callee.object.type === 'Identifier' &&
    callee.property.type === 'Identifier'
  ) {
    return `${callee.object.name}.${callee.property.name}`
  }
  return null
}

function isDescribeLike(node: Node): node is ExpressionStatement {
  const name = getCallName(node)
  return name !== null && DESCRIBE_LIKE_NAMES.has(name)
}

function isShuffleable(node: Node): boolean {
  const name = getCallName(node)
  return name !== null && (DESCRIBE_LIKE_NAMES.has(name) || IT_LIKE_NAMES.has(name))
}

/**
 * Shuffles only the describe-like and it-like statements within a body, leaving
 * all other statements (hooks, variables, imports) at their original positions.
 */
function shuffleShuffleableStatements(
  statements: Statement[],
  randomFn: () => number
): Statement[] {
  const shuffleableIndices = statements.reduce<number[]>((indices, stmt, index) => {
    if (isShuffleable(stmt)) indices.push(index)
    return indices
  }, [])

  if (shuffleableIndices.length < 2) return statements

  const shuffledNodes = shuffleArray(
    shuffleableIndices.map(index => statements[index] as Statement),
    randomFn
  )

  const result = [...statements]
  shuffleableIndices.forEach((originalIndex, position) => {
    result[originalIndex] = shuffledNodes[position] as Statement
  })
  return result
}

/**
 * Depth-first: recurse into nested describe-like blocks first, then shuffle
 * at this scope level. This ensures child scopes are stable before the parent
 * scope is shuffled.
 */
function processStatements(statements: Statement[], randomFn: () => number): Statement[] {
  const withProcessedChildren = statements.map(stmt => {
    if (!isDescribeLike(stmt)) return stmt

    const call = stmt.expression as CallExpression
    // Callback is the last argument — supports describe('name', options, callback)
    const lastArg = call.arguments[call.arguments.length - 1]
    if (
      lastArg?.type === 'ArrowFunctionExpression' ||
      lastArg?.type === 'FunctionExpression'
    ) {
      const fn = lastArg as ArrowFunctionExpression | FunctionExpression
      if (fn.body.type === 'BlockStatement') {
        fn.body.body = processStatements(fn.body.body, randomFn)
      }
    }

    return stmt
  })

  return shuffleShuffleableStatements(withProcessedChildren, randomFn)
}

/**
 * Parses spec source code, shuffles describe/it/test/context blocks at every
 * nesting level using randomFn, then regenerates the source. Non-test
 * statements (hooks, imports, variables) remain at their original positions.
 */
export function transformCode(code: string, randomFn: () => number): string {
  const ast = parse(code, {
    sourceType: 'module',
    plugins: ['typescript', 'jsx'],
  })

  ast.program.body = processStatements(ast.program.body, randomFn)

  const { code: transformed } = generate(ast)
  return transformed
}
