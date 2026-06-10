/**
 * Repair built-in MongoDB on shop PCs.
 * Run: REPAIR-DATABASE.bat  OR  node scripts/repair-database.mjs
 * Fresh reset (no real sales): node scripts/repair-database.mjs --reset-fresh
 */
import { existsSync, mkdirSync, readdirSync, renameSync, rmSync } from 'fs'
import { dirname, join } from 'path'
import { spawnSync } from 'child_process'
import { fileURLToPath } from 'url'
import { findBundledMongod } from './find-bundled-mongod.mjs'
import { banner, fail, initProgressLog, progress } from './progress.mjs'
import { runNodeScript } from './spawn-utils.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
initProgressLog(join(root, 'repair-log.txt'))

function killMongodWindows() {
  spawnSync('taskkill', ['/F', '/IM', 'mongod.exe'], { stdio: 'ignore', windowsHide: true })
}

function removeLocks(dbPath) {
  for (const name of ['mongod.lock', 'WiredTiger.lock']) {
    const file = join(dbPath, name)
    if (existsSync(file)) {
      rmSync(file, { force: true })
      progress(`Removed lock: ${name}`)
    }
  }
}

function dbHasShopData(dbPath) {
  if (!existsSync(dbPath)) return false
  try {
    const names = readdirSync(dbPath)
    return names.some(
      (n) =>
        n.startsWith('WiredTiger') ||
        n.startsWith('collection-') ||
        n.endsWith('.wt') ||
        n === 'storage.bson',
    )
  } catch {
    return false
  }
}

function warnOneDrive() {
  const normalized = root.replace(/\\/g, '/').toLowerCase()
  if (
    normalized.includes('/documents/') ||
    normalized.includes('onedrive') ||
    normalized.includes('/desktop/')
  ) {
    progress(
      'WARNING: App is under Documents/Desktop/OneDrive — move to C:\\BappiStores to stop database corruption.',
    )
  }
}

function quarantineDb(dbPath) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const backup = `${dbPath}.broken-${stamp}`
  if (existsSync(dbPath)) {
    renameSync(dbPath, backup)
    progress(`Moved broken database to: ${backup}`)
  }
  mkdirSync(dbPath, { recursive: true })
}

function main() {
  banner('Bappi Stores — REPAIR DATABASE')
  warnOneDrive()
  progress('Stopping any running mongod…')
  try {
    runNodeScript(join(root, 'scripts', 'stop-app.mjs'), [], root)
  } catch {
    killMongodWindows()
  }
  killMongodWindows()

  const dbPath = join(root, 'data', 'mongodb')
  const binCache = join(root, 'data', 'mongodb-bin')

  if (existsSync(binCache)) {
    rmSync(binCache, { recursive: true, force: true })
    progress('Cleared data/mongodb-bin cache')
  }

  const mongod = findBundledMongod(root)
  if (!mongod) {
    throw new Error(
      'bundled/mongod.exe not found.\n' +
        'Use the full BappiStores-Share zip — do not delete the bundled/ folder.',
    )
  }

  progress(`Testing ${mongod}`)
  const ver = spawnSync(mongod, ['--version'], { encoding: 'utf8', windowsHide: true, timeout: 30000 })
  if (ver.status !== 0) {
    throw new Error(
      'mongod.exe will not run on this PC.\n' +
        '1) Add this entire app folder to Windows Defender exclusions.\n' +
        '2) Check Protection history for quarantined mongod.exe.\n' +
        '3) Re-copy bundled/mongod.exe from a fresh zip.',
    )
  }
  progress(ver.stdout?.trim().split('\n')[0] || 'mongod OK')

  if (process.argv.includes('--reset-fresh')) {
    progress('Fresh database reset (sample data will be re-created on next START)…')
    quarantineDb(dbPath)
    progress('Run SETUP.bat or START.bat — seed runs automatically on empty database.')
    banner('RESET FINISHED')
    return
  }

  removeLocks(dbPath)

  if (dbHasShopData(dbPath)) {
    progress('Repairing shop database — please wait (can take several minutes)…')
    const repair = spawnSync(mongod, ['--dbpath', dbPath, '--repair'], {
      stdio: 'inherit',
      windowsHide: true,
      timeout: 600000,
    })
    removeLocks(dbPath)
    if (repair.status !== 0) {
      progress('Repair failed — use RESET-FRESH-DATABASE.bat only if you have NO real sales yet.')
      throw new Error(
        'mongod --repair failed.\n' +
          'If this is a new PC with only sample data: run RESET-FRESH-DATABASE.bat\n' +
          'If you have real sales: run BACKUP.bat on another copy, then contact IT.',
      )
    }
    progress('Database repair finished')
  } else {
    progress('No database files yet — locks/cache cleared only')
  }

  banner('REPAIR FINISHED')
  progress('Now double-click START.bat.')
  progress('Strongly recommended: move folder to C:\\BappiStores (not Documents/OneDrive).')
}

try {
  main()
} catch (err) {
  fail(err.message || String(err))
  console.error('\n', err.message || err)
  progress('See repair-log.txt in this folder.')
  process.exit(1)
}
