import { readFile } from 'node:fs/promises'
import { watch } from 'node:fs'
import type { FSWatcher } from 'node:fs'
import * as nodePath from 'node:path'
import type { EventEmitter } from 'node:events'
import * as esbuild from 'esbuild'
import { transformCode } from './block-randomizer.js'
import { createPrng } from './seeded-random.js'

export interface CypressPreprocessorFile extends EventEmitter {
  filePath: string
  outputPath: string
  shouldWatch: boolean
}

export interface PreprocessorOptions {
  seed: string | number
  randomizeBlocks: boolean
}

function inferLoader(filePath: string): esbuild.Loader {
  const ext = nodePath.extname(filePath).toLowerCase()
  if (ext === '.ts') return 'ts'
  if (ext === '.tsx') return 'tsx'
  if (ext === '.jsx') return 'jsx'
  return 'js'
}

function createTransformPlugin(
  targetFilePath: string,
  randomFn: (() => number) | null
): esbuild.Plugin {
  return {
    name: 'cypress-test-order-randomizer',
    setup(build) {
      // Only intercept the spec entry point — let esbuild handle all imports normally
      build.onLoad({ filter: /.*/, namespace: 'file' }, async (args) => {
        if (args.path !== targetFilePath) return
        const source = await readFile(args.path, 'utf-8')
        const contents = randomFn !== null ? transformCode(source, randomFn) : source
        return { contents, loader: inferLoader(args.path) }
      })
    },
  }
}

async function buildSpec(
  filePath: string,
  outputPath: string,
  plugin: esbuild.Plugin
): Promise<void> {
  await esbuild.build({
    entryPoints: [filePath],
    bundle: true,
    outfile: outputPath,
    platform: 'browser',
    format: 'iife',
    plugins: [plugin],
    logLevel: 'silent',
  })
}

/**
 * Creates a Cypress file:preprocessor handler that bundles spec files with
 * esbuild and optionally shuffles describe/it blocks using AST transformation.
 *
 * Each spec file gets an independent PRNG derived from `seed + filePath` so
 * shuffles are stable and reproducible per file.
 */
export function createPreprocessor(
  options: PreprocessorOptions
): (file: CypressPreprocessorFile) => Promise<string> {
  const { seed, randomizeBlocks } = options
  const activeWatchers = new Map<string, FSWatcher>()

  return async function processFile(file: CypressPreprocessorFile): Promise<string> {
    const { filePath, outputPath, shouldWatch } = file

    // Derive a per-file PRNG so each spec's shuffle is independent but stable
    const randomFn = randomizeBlocks ? createPrng(`${seed}:${filePath}`) : null
    await buildSpec(filePath, outputPath, createTransformPlugin(filePath, randomFn))

    if (shouldWatch && !activeWatchers.has(filePath)) {
      const watcher = watch(filePath, async () => {
        const freshRandomFn = randomizeBlocks ? createPrng(`${seed}:${filePath}`) : null
        await buildSpec(filePath, outputPath, createTransformPlugin(filePath, freshRandomFn))
        file.emit('rerun')
      })

      activeWatchers.set(filePath, watcher)
      file.on('close', () => {
        activeWatchers.get(filePath)?.close()
        activeWatchers.delete(filePath)
      })
    }

    return outputPath
  }
}
