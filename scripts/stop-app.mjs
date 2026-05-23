/**
 * Stop the shop server so FIX-INVOICES / REPAIR can open the database.
 * Used by STOP-APP.bat and FIX-INVOICES.bat.
 */
import { existsSync, readFileSync, unlinkSync } from 'fs'
import { dirname, join } from 'path'
import { spawnSync } from 'child_process'
import { fileURLToPath } from 'url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const pidFile = join(root, 'data', '.server.pid')

function killTree(pid) {
  const n = Number(pid)
  if (!Number.isFinite(n) || n <= 0) return false
  if (process.platform === 'win32') {
    const r = spawnSync('taskkill', ['/PID', String(n), '/T', '/F'], {
      encoding: 'utf8',
      windowsHide: true,
    })
    const out = `${r.stdout || ''}${r.stderr || ''}`
    return r.status === 0 || /not found/i.test(out)
  }
  try {
    process.kill(n, 'SIGTERM')
    return true
  } catch {
    return false
  }
}

let stopped = false

if (existsSync(pidFile)) {
  const pid = readFileSync(pidFile, 'utf8').trim()
  console.log(`Stopping shop server (PID ${pid})…`)
  stopped = killTree(pid)
  try {
    unlinkSync(pidFile)
  } catch {
    /* ignore */
  }
} else {
  console.log('No server PID file — app may already be stopped.')
}

if (process.platform === 'win32') {
  spawnSync('taskkill', ['/F', '/IM', 'mongod.exe'], { stdio: 'ignore', windowsHide: true })
}

console.log(stopped ? 'App stopped. Wait a few seconds before FIX-INVOICES or SETUP.' : 'Done.')
process.exit(0)
