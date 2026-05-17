/**
 * Start the shop (build UI if needed, then run API). Used by START.bat — no shell npm.
 */
import { existsSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { runNpm, runNodeScript } from './spawn-utils.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const distIndex = join(root, 'client', 'dist', 'index.html')
const serverEntry = join(root, 'server', 'src', 'server.js')

if (!existsSync(join(root, 'server', 'node_modules'))) {
  console.error('\nRun SETUP.bat first (packages not installed).\n')
  process.exit(1)
}

if (!existsSync(distIndex)) {
  console.log('Building shop screens (first start)…\n')
  runNpm(['run', 'build'], join(root, 'client'))
}

console.log('Starting Bappi Stores…\n')
runNodeScript(serverEntry, [], join(root, 'server'))
