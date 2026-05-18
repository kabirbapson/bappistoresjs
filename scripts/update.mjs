/**
 * Update an existing install: refresh packages + UI build. Does NOT reset sales data.
 * Run: npm run update   OR   double-click UPDATE.bat
 */
import { existsSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { appUrl } from './app-host.mjs'
import { banner, fail, initProgressLog, progress, step, stepOk } from './progress.mjs'
import { isOfflineBundle } from './node-runtime.mjs'
import { runNpm } from './spawn-utils.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const offline = isOfflineBundle()
const TOTAL_STEPS = offline ? 2 : 3

initProgressLog(join(root, 'update-log.txt'))

function main() {
  if (!existsSync(join(root, '.setup-complete')) && !existsSync(join(root, 'data/mongodb'))) {
    progress('No existing install found. Run SETUP.bat first (one time).')
    process.exit(1)
  }

  banner('Bappi Stores — UPDATE (keeps your sales)')
  progress('Your data in data/mongodb and server/uploads will NOT be deleted.')
  if (offline) {
    progress('Offline package — skipping npm downloads (use a new zip from IT for dependency updates).')
  }
  progress('Full log also saved to: update-log.txt')

  if (offline) {
    step(1, TOTAL_STEPS, 'Verify offline packages')
    if (!existsSync(join(root, 'server', 'node_modules'))) {
      throw new Error('server/node_modules missing. Copy the full offline zip from IT.')
    }
    stepOk('Packages present')
  } else {
    step(1, TOTAL_STEPS, 'Refresh packages (root)')
    progress('Running npm install…')
    runNpm(['install'], root)
    stepOk('Root packages updated')

    step(2, TOTAL_STEPS, 'Refresh packages (client + server)')
    progress('Running npm install in client/…')
    runNpm(['install'], join(root, 'client'))
    progress('Running npm install in server/…')
    runNpm(['install'], join(root, 'server'))
    stepOk('Client and server packages updated')
  }

  const buildStep = offline ? 2 : 3
  step(buildStep, TOTAL_STEPS, 'Build latest shop screens')
  progress('Running production build (vite build)…')
  runNpm(['run', 'build'], join(root, 'client'))
  stepOk('Shop app built')

  const url = appUrl(5001)
  banner('UPDATE FINISHED')
  progress(`Open the shop: ${url}`)
  progress('Double-click START.bat to run.')
}

try {
  main()
} catch (err) {
  fail(err.message || String(err))
  console.error('\n========================================')
  console.error('  Update failed')
  console.error('========================================\n')
  console.error(err.message || String(err))
  if (err.stack) console.error(err.stack)
  progress('See update-log.txt in this folder for the full log.')
  process.exit(1)
}
