/**
 * Creates builds/BappiStores-Share/ — offline-ready zip for shop PCs (no internet on SETUP).
 * Run on a Windows dev PC with internet: npm run build:share
 */
import { randomBytes } from 'crypto'
import { spawnSync } from 'child_process'
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, unlinkSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath, pathToFileURL } from 'url'
import { banner, progress, step, stepOk } from './progress.mjs'
import { runNpm } from './spawn-utils.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const BUILDS_DIR = join(root, 'builds')
const PACKAGE_NAME = 'BappiStores-Share'
let dest = join(BUILDS_DIR, PACKAGE_NAME)

const CP_OPTS = { recursive: true, maxRetries: 5, retryDelay: 500 }

function sleepMs(ms) {
  if (process.platform === 'win32') {
    spawnSync('powershell', ['-NoProfile', '-Command', `Start-Sleep -Milliseconds ${ms}`], {
      stdio: 'ignore',
      windowsHide: true,
    })
  } else {
    spawnSync('sleep', [String(Math.ceil(ms / 1000))], { stdio: 'ignore' })
  }
}

/** Stop shop server + mongod so bundled/ and data/ are not locked during the zip build. */
function releaseShopLocks() {
  progress('Stopping shop server / database if running (avoids locked files)…')
  const pidFile = join(root, 'data', '.server.pid')
  if (existsSync(pidFile)) {
    const pid = readFileSync(pidFile, 'utf8').trim()
    const n = Number(pid)
    if (Number.isFinite(n) && n > 0) {
      if (process.platform === 'win32') {
        spawnSync('taskkill', ['/PID', String(n), '/T', '/F'], { stdio: 'ignore', windowsHide: true })
      } else {
        try {
          process.kill(n, 'SIGTERM')
        } catch {
          /* ignore */
        }
      }
    }
    try {
      unlinkSync(pidFile)
    } catch {
      /* ignore */
    }
  }
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/F', '/IM', 'mongod.exe'], { stdio: 'ignore', windowsHide: true })
  }
  sleepMs(2000)
}

function prepareDestFolder() {
  if (!existsSync(dest)) {
    mkdirSync(dest, { recursive: true })
    return
  }
  try {
    rmSync(dest, { recursive: true, force: true, maxRetries: 3, retryDelay: 500 })
    mkdirSync(dest, { recursive: true })
  } catch (err) {
    if (err.code === 'EBUSY' || err.code === 'EPERM') {
      dest = join(BUILDS_DIR, `${PACKAGE_NAME}-${Date.now()}`)
      console.warn(`\n  Folder locked — using ${dest} instead.\n`)
      mkdirSync(dest, { recursive: true })
      return
    }
    throw err
  }
}

const COPY_DIRS = ['client', 'server', 'scripts']

const COPY_FILES = [
  'package.json',
  'package-lock.json',
  'README.md',
  'SETUP.txt',
  'UPGRADE.txt',
  'SETUP.bat',
  'START.bat',
  'UPDATE.bat',
  'BACKUP.bat',
  'CONFIGURE-HOSTNAME.bat',
  'REPAIR-DATABASE.bat',
  'RESET-FRESH-DATABASE.bat',
  'TEST-DATABASE.bat',
  'CHECK-INSTALL.bat',
  'FIX-INVOICES.bat',
  'STOP-APP.bat',
  'RESTORE-BACKUP.bat',
  'scripts/repair-database.bat',
  'SETUP.command',
  'START.command',
  'UPDATE.command',
  'BACKUP.command',
]

const SKIP_DIR_NAMES = new Set([
  'node_modules',
  '.git',
  '.cursor',
  '.vscode',
  'builds',
  'Backups',
  'dist',
])

function shouldSkipFile(name) {
  return name === '.env' || name === '.setup-complete' || name === '.DS_Store'
}

function copyDir(src, dst) {
  mkdirSync(dst, { recursive: true })
  for (const entry of readdirSync(src, { withFileTypes: true })) {
    if (SKIP_DIR_NAMES.has(entry.name)) continue
    if (entry.isDirectory()) {
      copyDir(join(src, entry.name), join(dst, entry.name))
    } else if (entry.isFile()) {
      if (shouldSkipFile(entry.name)) continue
      cpSync(join(src, entry.name), join(dst, entry.name), CP_OPTS)
    }
  }
}

function copyNodeModules(label, relPath) {
  const src = relPath ? join(root, relPath, 'node_modules') : join(root, 'node_modules')
  if (!existsSync(src)) {
    throw new Error(`Missing ${label} node_modules — run npm install first`)
  }
  const dst = relPath ? join(dest, relPath, 'node_modules') : join(dest, 'node_modules')
  progress(`Copying ${label} node_modules (large, please wait)…`)
  cpSync(src, dst, CP_OPTS)
}

function copyBundledFolder() {
  const src = join(root, 'bundled')
  const dst = join(dest, 'bundled')
  if (!existsSync(src)) {
    throw new Error('bundled/ missing — step 2 (MongoDB + Node) did not finish')
  }
  progress('Copying bundled/ (MongoDB + Node.js)…')
  try {
    cpSync(src, dst, CP_OPTS)
  } catch (err) {
    if (err.code === 'EBUSY' || err.code === 'EPERM') {
      console.warn('  bundled/ partially locked — copying file-by-file…')
      mkdirSync(dst, { recursive: true })
      for (const entry of readdirSync(src, { withFileTypes: true })) {
        const from = join(src, entry.name)
        const to = join(dst, entry.name)
        try {
          if (entry.isDirectory()) {
            cpSync(from, to, CP_OPTS)
          } else {
            cpSync(from, to)
          }
        } catch (copyErr) {
          if ((copyErr.code === 'EBUSY' || copyErr.code === 'EPERM') && existsSync(to)) {
            console.warn(`  skipped locked (already present): ${entry.name}`)
            continue
          }
          throw copyErr
        }
      }
    } else {
      throw err
    }
  }
  console.log('  + bundled/')
}

function shopServerEnv() {
  let tpl = readFileSync(join(root, 'server/.env.example'), 'utf8')
  tpl = tpl.replace('JWT_SECRET=change-this-secret', `JWT_SECRET=${randomBytes(24).toString('hex')}`)
  if (!/MONGOMS_STARTUP_TIMEOUT=/m.test(tpl)) {
    tpl += '\nMONGOMS_STARTUP_TIMEOUT=300000\n'
  }
  const mongod = join(root, 'bundled', 'mongod.exe').replace(/\\/g, '/')
  if (existsSync(join(root, 'bundled', 'mongod.exe')) && !/MONGODB_SYSTEM_BINARY=/m.test(tpl)) {
    tpl += `MONGODB_SYSTEM_BINARY=${mongod}\n`
  }
  return tpl
}

const TOTAL = 6

mkdirSync(BUILDS_DIR, { recursive: true })

banner(`Building ${PACKAGE_NAME} → builds/`)
releaseShopLocks()
progress('Close npm run dev / START.bat on this PC before building if copies still fail.\n')

step(1, TOTAL, 'Install all packages (build PC only — needs internet)')
progress('npm install in project root…')
runNpm(['install'], root)
progress('npm install in client/…')
runNpm(['install'], join(root, 'client'))
progress('npm install in server/…')
runNpm(['install'], join(root, 'server'))
stepOk('All npm packages installed')

step(2, TOTAL, 'Bundle MongoDB + Node.js for shop PCs')
await import(pathToFileURL(join(root, 'scripts', 'download-bundled-mongodb.mjs')).href)
await import(pathToFileURL(join(root, 'scripts', 'download-bundled-node.mjs')).href)
stepOk('bundled/mongodb and bundled/nodejs ready')

step(3, TOTAL, 'Build shop UI (production)')
progress('Running vite build in client/…')
runNpm(['run', 'build'], join(root, 'client'))
stepOk('client/dist ready')

step(4, TOTAL, 'Copy app files')
progress('Preparing share folder…')
prepareDestFolder()

for (const file of COPY_FILES) {
  const src = join(root, file)
  if (existsSync(src)) {
    cpSync(src, join(dest, file), CP_OPTS)
    console.log(`  + ${file}`)
  }
}

for (const dir of COPY_DIRS) {
  const src = join(root, dir)
  if (existsSync(src)) {
    copyDir(src, join(dest, dir))
    console.log(`  + ${dir}/`)
  }
}

const clientDist = join(root, 'client', 'dist')
if (existsSync(clientDist)) {
  cpSync(clientDist, join(dest, 'client', 'dist'), CP_OPTS)
  console.log('  + client/dist/')
}

step(5, TOTAL, 'Copy offline bundles (node_modules + MongoDB + Node)')
copyNodeModules('root', '')
copyNodeModules('client', 'client')
copyNodeModules('server', 'server')

copyBundledFolder()

writeFileSync(
  join(dest, 'bundled', 'OFFLINE.txt'),
  `Bappi Stores offline package
Built: ${new Date().toISOString()}
Shop PCs do not need internet for SETUP.bat.
`,
)

step(6, TOTAL, 'Shop config files')
writeFileSync(join(dest, 'server', '.env'), shopServerEnv())
writeFileSync(join(dest, 'client', '.env'), readFileSync(join(root, 'client/.env.example'), 'utf8'))
mkdirSync(join(dest, 'data'), { recursive: true })
mkdirSync(join(dest, 'server', 'uploads', 'products'), { recursive: true })
mkdirSync(join(dest, 'server', 'uploads', 'branding'), { recursive: true })
console.log('  + server/.env, client/.env, data/, uploads/')

writeFileSync(
  join(dest, 'READ-ME-FIRST.txt'),
  `BAPPI STORES — READ THIS FIRST
==============================

OFFLINE PACKAGE (this zip)
--------------------------
- No internet needed on the shop PC for setup.
- Node.js and MongoDB are included in the  bundled/  folder.
- All npm packages are included (node_modules).

WHERE TO INSTALL (VERY IMPORTANT)
-----------------------------------
  YES:  C:\\BappiStores
  NO:   Documents, Desktop, OneDrive, Downloads

  OneDrive/Documents corrupts the database (WiredTiger errors on START).

NEW COMPUTER (first time)
-------------------------
1. Unzip to C:\\BappiStores  (create the folder if needed)
2. Optional: CHECK-INSTALL.bat — confirms folder + database engine
3. Double-click SETUP.bat — wait until "SETUP FINISHED SUCCESSFULLY"
4. Add C:\\BappiStores to Windows Defender exclusions
5. Every day: START.bat — browser http://localhost:5001
   Login: admin@bappi.com / admin123
6. Optional: CONFIGURE-HOSTNAME.bat as Administrator

You do NOT need to install Node.js from nodejs.org for this offline zip.

ALREADY USING BAPPI STORES? (software update)
---------------------------------------------
Read UPGRADE.txt — use UPDATE.bat, NOT SETUP.bat.
Your sales stay in the  data/mongodb  folder.
Run BACKUP.bat before updating (recommended).

Do NOT delete:
  data/mongodb     — all sales, products, customers, debts
  server/uploads   — product photos you uploaded
  bundled/         — required for database and Node.js

Database error on START?
  → Move folder to C:\\BappiStores if it is in Documents/Desktop
  → STOP-APP.bat, then REPAIR-DATABASE.bat, then START.bat
  → New PC with no real sales: RESET-FRESH-DATABASE.bat
Duplicate invoice error? Run FIX-INVOICES.bat (START.bat can stay open).
Receipt not printing? Open receipt preview, choose paper width, click Print receipt (scale 100%).
Setup failed? Open setup-log.txt and send to IT.

Zip size is large (~1 GB) because everything is included.
More help: SETUP.txt and UPGRADE.txt
`,
)

banner('OFFLINE SHARE PACKAGE READY')
progress(`Folder: ${dest}`)
progress(`All builds live under: ${BUILDS_DIR}`)
progress('Zip the BappiStores-Share folder and copy to shop PCs (USB or network).')
progress('On each PC: SETUP.bat once, then START.bat daily.')
progress('Shop PCs do not need internet for setup.\n')
