/**
 * Update an existing install: refresh packages + UI build. Does NOT reset sales data.
 * Run: npm run update   OR   double-click UPDATE.bat
 */
import { existsSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { appUrl } from './app-host.mjs'
import { runNpm } from './spawn-utils.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

function log(msg) {
  console.log(msg)
}

function main() {
  if (!existsSync(join(root, '.setup-complete')) && !existsSync(join(root, 'data/mongodb'))) {
    log('\nNo existing install found. Run SETUP.bat first (one time).\n')
    process.exit(1)
  }

  log('\n========================================')
  log('  Bappi Stores — update (keep your data)')
  log('========================================\n')
  log('Your records in  data/mongodb  and product photos in  server/uploads')
  log('are NOT deleted by this update.\n')

  log('Step 1/3 — Install / refresh packages (root)')
  runNpm(['install'], root)

  log('\nStep 2/3 — Install / refresh packages (client + server)')
  runNpm(['install'], join(root, 'client'))
  runNpm(['install'], join(root, 'server'))

  log('\nStep 3/3 — Build shop app (latest screens)')
  runNpm(['run', 'build'], join(root, 'client'))

  log('\nDone (sample seed skipped — your sales are unchanged)')

  const url = appUrl(5001)
  log('\n========================================')
  log('  Update finished')
  log('========================================\n')
  log(`Open the shop: ${url}`)
  log('Double-click START.bat to run.\n')
}

try {
  main()
} catch (err) {
  console.error('\n========================================')
  console.error('  Update failed')
  console.error('========================================\n')
  console.error(err.message || String(err))
  if (err.stack) console.error(err.stack)
  process.exit(1)
}
