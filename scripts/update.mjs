/**
 * Update an existing install: refresh packages + UI build. Does NOT reset sales data.
 * Run: npm run update   OR   double-click UPDATE.bat
 */
import { spawnSync } from 'child_process'
import { existsSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { appUrl } from './app-host.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const isWin = process.platform === 'win32'

function log(msg) {
  console.log(msg)
}

function fail(msg) {
  console.error(`\nError: ${msg}`)
  process.exit(1)
}

function run(cmd, args, cwd = root) {
  const result = spawnSync(cmd, args, {
    cwd,
    stdio: 'inherit',
    shell: isWin,
    env: process.env,
  })
  if (result.status !== 0) {
    fail(`Command failed: ${cmd} ${args.join(' ')}`)
  }
}

function npm(args, cwd = root) {
  run(isWin ? 'npm.cmd' : 'npm', args, cwd)
}

if (!existsSync(join(root, '.setup-complete')) && !existsSync(join(root, 'data/mongodb'))) {
  log('\nNo existing install found. Run SETUP.bat first (one time).\n')
  process.exit(1)
}

log('\n========================================')
log('  Bappi Stores — update (keep your data)')
log('========================================\n')
log('Your records in  data/mongodb  and product photos in  server/uploads')
log('are NOT deleted by this update.\n')

log('Step 1/3 — Install / refresh packages')
npm(['install'], root)
npm(['install'], join(root, 'client'))
npm(['install'], join(root, 'server'))

log('\nStep 2/3 — Build shop app (latest screens)')
npm(['run', 'build'], join(root, 'client'))

log('\nStep 3/3 — Done (skipped sample seed — your sales are unchanged)')

const url = appUrl(5001)
log('\n========================================')
log('  Update finished')
log('========================================\n')
log(`Open the shop: ${url}`)
log('Double-click START.bat to run.\n')
