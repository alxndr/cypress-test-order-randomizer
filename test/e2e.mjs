/**
 * End-to-end validation script for adding the cypress-test-order-randomizer
 * plugin to a Cypress test suite and verifying the changes to how tests are run.
 *
 * This will run real Cypress processes against the fixture project in fixtures/
 * and validates that test execution order matches what the plugin promises.
 *
 * Each cypress run takes 30–60 s; the full suite runs seven of them (~6 min).
 * suite-d (.cy.tsx) is included in all runs; no extra run is needed for it.
 * Two extra runs use alternate fixture configs to validate the programmatic
 * options path and the --env-overrides-options priority rule.
 *
 * Usage: node test/e2e.mjs   (or via `npm run test:e2e`)
 */

import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = fileURLToPath(new URL('..', import.meta.url))
const fixturesDir = join(projectRoot, 'test', 'fixtures')
const cypressBin  = join(projectRoot, 'node_modules', '.bin', 'cypress')

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

/**
 * Runs `cypress run` against the fixture project and returns the passing and
 * failing test titles in execution order.
 *
 * Options:
 *   env        — value for --env (omit to pass no --env flag)
 *   configFile — filename of an alternate config in test/fixtures/ (omit to use
 *                the default cypress.config.mjs in that directory)
 *
 * Uses --reporter json-stream, which emits one JSON array per Mocha event on
 * stdout. Passing tests produce lines like: ["pass",{"fullTitle":"suite-a A1"}]
 * We filter for those lines rather than trying to parse a combined JSON report,
 * because Cypress 15 ignores --reporter-options output= and emits per-spec JSON
 * to stdout directly.
 *
 * Note: json-stream has no handler for the Mocha "pending" event, so skipped
 * tests (it.skip / describe.skip) are validated by their absence from both the
 * passing and failing lists.
 *
 * Returns { passing, failing } — arrays of fullTitle strings in execution order.
 */
function runCypress({ env = undefined, configFile = undefined } = {}) {
  const args = ['run', '--reporter', 'json-stream', '--project', fixturesDir]
  if (configFile !== undefined) args.push('--config-file', configFile)
  if (env !== undefined) args.push('--env', env)
  const result = spawnSync(
    cypressBin,
    args,
    { encoding: 'utf-8', cwd: projectRoot, timeout: 120_000 },
  )

  if (result.error) {
    throw new Error(`Failed to launch Cypress: ${result.error.message}`)
  }

  const passing = []
  const failing = []
  for (const line of result.stdout.split('\n')) {
    if (line.startsWith('["pass"')) {
      try {
        const [, test] = JSON.parse(line)
        passing.push(test.fullTitle)
      } catch {
        // Not a JSON line — skip Cypress's own terminal output
      }
    } else if (line.startsWith('["fail"')) {
      try {
        const [, test] = JSON.parse(line)
        failing.push(test.fullTitle)
      } catch {
        // Not a JSON line — skip
      }
    }
  }

  if (passing.length === 0) {
    throw new Error(
      `No passing tests found in Cypress output (exit ${result.status}).` +
      `\nStdout (first 500 chars): ${result.stdout.slice(0, 500)}` +
      `\nStderr (first 500 chars): ${result.stderr.slice(0, 500)}`,
    )
  }

  return { passing, failing }
}

// ---------------------------------------------------------------------------
// Run all Cypress scenarios up-front, then assert on their outputs.
// This keeps each scenario description tightly coupled to a single run.
// ---------------------------------------------------------------------------

const scenarios = [
  { label: 'seed=42 (run 1)',               env: 'seed=42' },
  { label: 'seed=42 (run 2)',               env: 'seed=42' },
  { label: 'seed=43',                       env: 'seed=43' },
  { label: 'seed=42, randomizeBlocks=false', env: 'seed=42,randomizeBlocks=false' },
  { label: 'seed=42, randomizeFiles=false',  env: 'seed=42,randomizeFiles=false' },
  // Config-path scenarios: options set programmatically, not via --env
  { label: 'programmatic options (seed=42, randomizeBlocks=false)',
    configFile: 'cypress.config.options-only.mjs' },
  { label: 'env overrides programmatic options (randomizeBlocks false→true)',
    env: 'randomizeBlocks=true,seed=42',
    configFile: 'cypress.config.env-overrides-options.mjs' },
]

const results = []
for (const [index, { label, env, configFile }] of scenarios.entries()) {
  console.log(`[${index + 1}/${scenarios.length}] Running Cypress: ${label}`)
  results.push(runCypress({ env, configFile }))
}

const [
  resultSeed42a,
  resultSeed42b,
  resultSeed43,
  resultNoBlocks,
  resultNoFiles,
  resultOptionsOnly,
  resultEnvOverridesOptions,
] = results

// Convenience aliases — existing assertions below operate on passing-title arrays
const orderSeed42a  = resultSeed42a.passing
const orderSeed42b  = resultSeed42b.passing
const orderSeed43   = resultSeed43.passing
const orderNoBlocks = resultNoBlocks.passing
const orderNoFiles  = resultNoFiles.passing

// ---------------------------------------------------------------------------
// Assertions
// ---------------------------------------------------------------------------

let passed = 0
let failed = 0

function check(label, fn) {
  try {
    fn()
    console.log(`  ✓  ${label}`)
    passed++
  } catch (err) {
    console.error(`  ✗  ${label}`)
    console.error(`     ${err.message}`)
    failed++
  }
}

console.log('\nAssertions:')

// -- Reproducibility ---------------------------------------------------------

check('same seed produces identical execution order across runs', () => {
  assert.deepEqual(orderSeed42a, orderSeed42b)
})

check('different seeds produce different execution orders', () => {
  assert.notDeepEqual(orderSeed42a, orderSeed43)
})

// -- randomizeBlocks=false ---------------------------------------------------

check('randomizeBlocks=false: suite-a it-blocks appear in declaration order', () => {
  const names = orderNoBlocks
    .filter(t => t.startsWith('suite-a '))
    .map(t => t.slice('suite-a '.length))
  assert.deepEqual(names, ['A1', 'A2', 'A3', 'A4', 'A5', 'A6'])
})

check('randomizeBlocks=false: suite-b it-blocks appear in declaration order', () => {
  const names = orderNoBlocks
    .filter(t => t.startsWith('suite-b '))
    .map(t => t.slice('suite-b '.length))
  assert.deepEqual(names, ['B1', 'B2', 'B3', 'B4', 'B5', 'B6'])
})

check('randomizeBlocks=false: nested inner-1 it-blocks appear in declaration order', () => {
  const names = orderNoBlocks
    .filter(t => t.startsWith('suite-c inner-1 '))
    .map(t => t.slice('suite-c inner-1 '.length))
  assert.deepEqual(names, ['C1', 'C2', 'C3', 'C4', 'C5', 'C6'])
})

check('randomizeBlocks=false: nested inner-2 direct it-blocks appear in declaration order', () => {
  // Anchor on C\d+ to exclude the doubly-nested "inner-2 nested 1" titles
  const names = orderNoBlocks
    .filter(t => /^suite-c inner-2 C\d+$/.test(t))
    .map(t => t.slice('suite-c inner-2 '.length))
  assert.deepEqual(names, ['C7', 'C8', 'C9', 'C13', 'C14', 'C15'])
})

check('randomizeBlocks=false: doubly-nested inner-2 nested 1 it-blocks appear in declaration order', () => {
  const names = orderNoBlocks
    .filter(t => t.startsWith('suite-c inner-2 inner-2 nested 1 '))
    .map(t => t.slice('suite-c inner-2 inner-2 nested 1 '.length))
  assert.deepEqual(names, ['C10', 'C11', 'C12'])
})

// -- randomizeBlocks=true (seed=42) ------------------------------------------

check('randomizeBlocks=true: nested inner-1 it-blocks are shuffled from declaration order', () => {
  const names = orderSeed42a
    .filter(t => t.startsWith('suite-c inner-1 '))
    .map(t => t.slice('suite-c inner-1 '.length))
  // All tests present
  assert.deepEqual([...names].toSorted(), ['C1', 'C2', 'C3', 'C4', 'C5', 'C6'])
  // Order changed (6! = 720; probability of accidental match is ~0.14%)
  assert.notDeepEqual(names, ['C1', 'C2', 'C3', 'C4', 'C5', 'C6'])
})

check('randomizeBlocks=true: nested inner-2 direct it-blocks are shuffled from declaration order', () => {
  const names = orderSeed42a
    .filter(t => /^suite-c inner-2 C\d+$/.test(t))
    .map(t => t.slice('suite-c inner-2 '.length))
  // All 6 direct it-blocks present (C13 < C14 < C15 < C7 < C8 < C9 alphabetically)
  assert.deepEqual([...names].toSorted(), ['C13', 'C14', 'C15', 'C7', 'C8', 'C9'])
  assert.notDeepEqual(names, ['C7', 'C8', 'C9', 'C13', 'C14', 'C15'])
})

check('randomizeBlocks=true: doubly-nested inner-2 nested 1 it-blocks are shuffled from declaration order', () => {
  const names = orderSeed42a
    .filter(t => t.startsWith('suite-c inner-2 inner-2 nested 1 '))
    .map(t => t.slice('suite-c inner-2 inner-2 nested 1 '.length))
  // All 3 present (3! = 6; ~17% chance seed=42 happens to preserve order — acceptable)
  assert.deepEqual([...names].toSorted(), ['C10', 'C11', 'C12'])
  assert.notDeepEqual(names, ['C10', 'C11', 'C12'])
})

// -- suite-d: TSX spec + it.skip / describe.skip -----------------------------
// Uses resultNoBlocks (randomizeBlocks=false) for these checks: the suite-d
// assertions are about TSX spec discovery and skip handling, not block
// shuffling. With randomizeBlocks=false the source is not AST-transformed, so
// every non-skipped test runs exactly as written.
// json-stream has no pending event, so skipped tests are validated by absence
// from both the passing and failing lists.

check('suite-d (tsx): non-skipped it-blocks appear in passing results', () => {
  assert.ok(resultNoBlocks.passing.includes('suite-d D1'), 'D1 should pass')
  assert.ok(resultNoBlocks.passing.includes('suite-d D3'), 'D3 should pass')
  assert.ok(resultNoBlocks.passing.includes('suite-d inner-d-running D6'), 'D6 (inner-d-running direct) should pass')
  assert.ok(resultNoBlocks.passing.includes('suite-d inner-d-running inner-d-running nested D7'), 'D7 (inner-d-running nested) should pass')
  assert.ok(resultNoBlocks.passing.includes('suite-d inner-d-running inner-d-running nested D8'), 'D8 (inner-d-running nested) should pass')
  assert.ok(resultNoBlocks.passing.includes('suite-d inner-d-running D9'), 'D9 (inner-d-running direct) should pass')
  assert.ok(resultNoBlocks.passing.includes('suite-d D10'), 'D10 should pass')
})

check('suite-d (tsx): skipped tests do not appear in passing results', () => {
  assert.ok(!resultNoBlocks.passing.includes('suite-d D2'), 'D2 (it.skip) must not pass')
  assert.ok(!resultNoBlocks.passing.includes('suite-d inner-d-skipped D4'), 'D4 (describe.skip) must not pass')
  assert.ok(!resultNoBlocks.passing.includes('suite-d inner-d-skipped D5'), 'D5 (describe.skip) must not pass')
})

check('suite-d (tsx): skipped tests do not appear in failing results', () => {
  assert.ok(!resultNoBlocks.failing.includes('suite-d D2'), 'D2 (it.skip) must not fail')
  assert.ok(!resultNoBlocks.failing.includes('suite-d inner-d-skipped D4'), 'D4 (describe.skip) must not fail')
  assert.ok(!resultNoBlocks.failing.includes('suite-d inner-d-skipped D5'), 'D5 (describe.skip) must not fail')
})

// -- randomizeFiles=false ----------------------------------------------------

check('randomizeFiles=false: all suite-a tests run before suite-b', () => {
  const lastA  = orderNoFiles.findLastIndex(t => t.startsWith('suite-a '))
  const firstB = orderNoFiles.findIndex(t => t.startsWith('suite-b '))
  assert.ok(lastA >= 0 && firstB >= 0, 'both suites must appear in results')
  assert.ok(lastA < firstB, `expected last suite-a (${lastA}) < first suite-b (${firstB})`)
})

check('randomizeFiles=false: all suite-b tests run before suite-c', () => {
  const lastB  = orderNoFiles.findLastIndex(t => t.startsWith('suite-b '))
  const firstC = orderNoFiles.findIndex(t => t.startsWith('suite-c '))
  assert.ok(lastB >= 0 && firstC >= 0, 'both suites must appear in results')
  assert.ok(lastB < firstC, `expected last suite-b (${lastB}) < first suite-c (${firstC})`)
})

// -- programmatic config options (no --env) ----------------------------------

check('programmatic options: seed + randomizeBlocks=false produces same order as equivalent --env', () => {
  // options-only config hardcodes seed=42 + randomizeBlocks=false, no --env passed.
  // Must produce identical passing order to the --env seed=42,randomizeBlocks=false run.
  assert.deepEqual(resultOptionsOnly.passing, orderNoBlocks)
})

// -- priority: --env overrides programmatic options --------------------------

check('priority: --env randomizeBlocks=true overrides options.randomizeBlocks=false', () => {
  // env-overrides config hardcodes randomizeBlocks=false in options,
  // but --env randomizeBlocks=true,seed=42 takes priority.
  // Effective config matches seed=42 default (randomizeBlocks=true), so the
  // passing order must equal the first seed=42 run.
  assert.deepEqual(resultEnvOverridesOptions.passing, orderSeed42a)
})

// ---------------------------------------------------------------------------

console.log(`\n${passed + failed} checks — ${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
