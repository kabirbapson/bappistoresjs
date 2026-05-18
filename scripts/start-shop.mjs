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

console.log('')
console.log('==================================================')
console.log('  Bappi Stores is starting…')
console.log('==================================================')
console.log('')

if (!existsSync(distIndex)) {
  console.log('[1/2] Building shop screens (first start) — please wait…')
  runNpm(['run', 'build'], join(root, 'client'))
  console.log('      Done.\n')
}

console.log('[2/2] Starting server…')
console.log('      Browser: http://bappistores:5001')
console.log('      Leave this window open while using the app.\n')
runNodeScript(serverEntry, [], join(root, 'server'))
