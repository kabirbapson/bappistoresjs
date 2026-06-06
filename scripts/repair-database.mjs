/**
 * Repair built-in MongoDB on shop PCs. Keeps data/mongodb unless --reset-empty.
 * Run: REPAIR-DATABASE.bat  OR  node scripts/repair-database.mjs
 */
import { existsSync, readdirSync, rmSync } from 'fs'
import { dirname, join } from 'path'
import { spawnSync } from 'child_process'
import { fileURLToPath } from 'url'
import { findBundledMongod } from './find-bundled-mongod.mjs'
import { banner, fail, initProgressLog, progress } from './progress.mjs'
import { getNodeExe } from './node-runtime.mjs'
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
    return names.some((n) => n.startsWith('WiredTiger') || n.startsWith('collection-') || n.endsWith('.wt'))
  } catch {
    return false
  }
}

function main() {
  banner('Bappi Stores — REPAIR DATABASE')
  progress('Stopping any running mongod…')
  try {
    runNodeScript(join(root, 'scripts', 'stop-app.mjs'), [], root)
  } catch {
    killMongodWindows()
  }
  killMongodWindows()

  const dbPath = join(root, 'data', 'mongodb')
  const binCache = join(root, 'data', 'mongodb-bin')
  const bundledCache = join(root, 'bundled', 'mongodb-cache')

  if (existsSync(binCache)) {
    rmSync(binCache, { recursive: true, force: true })
    progress('Cleared data/mongodb-bin cache')
  }

  removeLocks(dbPath)

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

  if (process.argv.includes('--reset-empty') && !dbHasShopData(dbPath)) {
    if (existsSync(dbPath)) {
      rmSync(dbPath, { recursive: true, force: true })
      progress('Removed empty/corrupt data/mongodb folder')
    }
  } else if (dbHasShopData(dbPath)) {
    progress('Repairing shop database (sales kept) — please wait…')
    const repair = spawnSync(mongod, ['--dbpath', dbPath, '--repair'], {
      stdio: 'inherit',
      windowsHide: true,
      timeout: 600000,
    })
    if (repair.status !== 0) {
      throw new Error(
        'mongod --repair failed.\n' +
          'Run BACKUP.bat, then contact IT with repair-log.txt.',
      )
    }
    removeLocks(dbPath)
    progress('Database repair finished')
  } else {
    progress('No shop database files yet — locks/cache cleared only')
  }

  banner('REPAIR FINISHED')
  progress('Now double-click START.bat (wait 2–5 minutes on first start).')
  progress('If it still fails, move the folder to C:\\BappiStores and add Defender exclusion.')
}

try {
  main()
} catch (err) {
  fail(err.message || String(err))
  console.error('\n', err.message || err)
  progress('See repair-log.txt in this folder.')
  process.exit(1)
}
