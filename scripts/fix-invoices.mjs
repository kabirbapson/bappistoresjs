/**
 * Fix duplicate invoice numbers.
 * 1) Tries live fix via API (START.bat can stay open — recommended).
 * 2) Falls back to offline DB script if the app is not running.
 */
import { spawnSync } from 'child_process'
import dotenv from 'dotenv'
import { existsSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
dotenv.config({ path: join(root, 'server', '.env') })

const port = Number(process.env.PORT) || 5001
const secret = process.env.MAINTENANCE_SECRET || 'local-fix-invoices'

async function tryLiveFix() {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/maintenance/fix-invoices`, {
      method: 'POST',
      headers: { 'x-maintenance-key': secret },
    })
    const body = await res.json().catch(() => ({}))
    if (res.ok) {
      console.log(`\n${body.message || 'Done.'}`)
      if (body.changes?.length) {
        for (const line of body.changes) console.log(`  ${line}`)
      }
      return true
    }
    console.error('\nLive fix failed:', body.message || `HTTP ${res.status}`)
    return false
  } catch {
    return false
  }
}

function runOfflineFix() {
  const nodeExe = existsSync(join(root, 'bundled', 'nodejs', 'node.exe'))
    ? join(root, 'bundled', 'nodejs', 'node.exe')
    : 'node'

  console.log('\nStopping background database (if any)...')
  spawnSync(nodeExe, [join(root, 'scripts', 'stop-app.mjs')], {
    cwd: root,
    stdio: 'inherit',
    windowsHide: true,
  })

  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/F', '/IM', 'mongod.exe'], { stdio: 'ignore', windowsHide: true })
  }

  console.log('Waiting for database to release...')
  spawnSync('timeout', ['/t', '5', '/nobreak'], { stdio: 'ignore', windowsHide: true })

  const r = spawnSync(nodeExe, ['src/fix-duplicate-invoices.js'], {
    cwd: join(root, 'server'),
    stdio: 'inherit',
    windowsHide: true,
  })
  return r.status === 0
}

console.log('========================================')
console.log('  Fix duplicate invoices')
console.log('========================================')
console.log('\nStep 1: Fix while app is running (leave START.bat open)...')

if (await tryLiveFix()) {
  console.log('\nSuccess. No restart needed.\n')
  process.exit(0)
}

console.log('\nStep 2: App not running — offline fix...')
if (runOfflineFix()) {
  console.log('\nSuccess. Run START.bat to open the shop.\n')
  process.exit(0)
}

console.error('\nFix failed. See errors above.\n')
process.exit(1)
