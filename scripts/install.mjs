/**
 * One-time installer: config files, npm install (or offline verify), seed data.
 * Run: node scripts/install.mjs   OR   double-click SETUP.bat / SETUP.command
 */
import { randomBytes } from 'crypto'
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { appUrl } from './app-host.mjs'
import { findBundledMongod } from './find-bundled-mongod.mjs'
import { banner, fail, initProgressLog, progress, step, stepOk } from './progress.mjs'
import { getNodeExe, isOfflineBundle } from './node-runtime.mjs'
import { runNodeScript, runNpm } from './spawn-utils.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const isWin = process.platform === 'win32'
const offline = isOfflineBundle()
const TOTAL_STEPS = offline ? 3 : 5

initProgressLog(join(root, 'setup-log.txt'))

function ensureEnv(exampleRel, targetRel) {
  const example = join(root, exampleRel)
  const target = join(root, targetRel)
  if (existsSync(target)) {
    progress(`Config OK: ${targetRel} (already exists)`)
    return
  }
  if (!existsSync(example)) {
    throw new Error(`Missing ${exampleRel}`)
  }
  copyFileSync(example, target)
  progress(`Created ${targetRel}`)
}

function finalizeServerEnv() {
  const target = join(root, 'server/.env')
  if (!existsSync(target)) return
  let content = readFileSync(target, 'utf8')
  if (content.includes('JWT_SECRET=change-this-secret')) {
    content = content.replace(
      'JWT_SECRET=change-this-secret',
      `JWT_SECRET=${randomBytes(24).toString('hex')}`,
    )
    progress('Generated secure JWT_SECRET in server/.env')
  }
  const mongod = findBundledMongod()
  if (mongod && !/MONGODB_SYSTEM_BINARY=/m.test(content)) {
    const line = `MONGODB_SYSTEM_BINARY=${mongod.replace(/\\/g, '/')}\n`
    content += line
    progress('Using bundled MongoDB (no download needed)')
  }
  writeFileSync(target, content)
}

function applyBundledMongoEnv() {
  const mongod = findBundledMongod()
  if (mongod) {
    process.env.MONGODB_SYSTEM_BINARY = mongod
  }
}

function verifyOfflinePackages() {
  const required = [
    join(root, 'server', 'node_modules', 'mongoose'),
    join(root, 'client', 'node_modules', 'vite'),
    join(root, 'node_modules'),
  ]
  for (const path of required) {
    if (!existsSync(path)) {
      throw new Error(
        `Offline package is incomplete (missing ${path}).\n` +
          'Use the full BappiStores-Share zip from IT, or run build:share on a dev PC.',
      )
    }
  }
  if (!findBundledMongod()) {
    throw new Error(
      'Offline package is missing bundled MongoDB (bundled/mongod.exe).\n' +
        'Use the full zip from IT — do not delete the bundled/ folder.',
    )
  }
  if (!existsSync(getNodeExe()) && getNodeExe() !== process.execPath) {
    throw new Error(`Bundled Node.js not found: ${getNodeExe()}`)
  }
}

function hasPersistedShopData() {
  const dbPath = join(root, 'data/mongodb')
  if (!existsSync(dbPath)) return false
  try {
    return readdirSync(dbPath).length > 0
  } catch {
    return false
  }
}

function main() {
  const nodeMajor = Number.parseInt(process.versions.node.split('.')[0], 10)
  if (nodeMajor < 20) {
    throw new Error(
      `Node.js 20 or newer is required (you have ${process.versions.node}).\n` +
        (offline
          ? 'The bundled Node.js may be missing — use the full offline zip.'
          : 'Download LTS from https://nodejs.org then run setup again.'),
    )
  }

  banner('Bappi Stores — SETUP (first-time install)')
  progress(`Node.js ${process.versions.node}`)
  if (offline) {
    progress('Offline package detected — no internet required.')
  } else {
    progress('This may take 5–15 minutes on first run (downloads packages + database).')
  }
  progress('Full log also saved to: setup-log.txt')

  step(1, TOTAL_STEPS, 'Config files')
  ensureEnv('server/.env.example', 'server/.env')
  ensureEnv('client/.env.example', 'client/.env')
  applyBundledMongoEnv()
  finalizeServerEnv()
  stepOk('Configuration ready')

  if (offline) {
    step(2, TOTAL_STEPS, 'Verify offline bundle')
    verifyOfflinePackages()
    stepOk('All packages and database engine present')
  } else {
    step(2, TOTAL_STEPS, 'Install packages (main app)')
    progress('Running npm install in project root…')
    runNpm(['install'], root)
    stepOk('Main packages installed')

    step(3, TOTAL_STEPS, 'Install packages (shop screens)')
    progress('Running npm install in client/…')
    runNpm(['install'], join(root, 'client'))
    stepOk('Client packages installed')

    step(4, TOTAL_STEPS, 'Install packages (server)')
    progress('Running npm install in server/…')
    runNpm(['install'], join(root, 'server'))
    stepOk('Server packages installed')
  }

  const alreadyInstalled =
    existsSync(join(root, '.setup-complete')) || hasPersistedShopData()

  const dbStep = offline ? 3 : 5
  step(dbStep, TOTAL_STEPS, alreadyInstalled ? 'Finish (keep existing data)' : 'Database + admin user')

  if (alreadyInstalled) {
    progress('Existing shop data found — skipping sample products.')
    progress('For a software update, use UPDATE.bat instead of SETUP.')
  } else {
    if (offline) {
      progress('Starting built-in database (bundled — no download)…')
    } else {
      progress('Downloading built-in database engine (internet required, one time)…')
      progress('After download, first start can take 2–5 minutes on slow PCs — please wait…')
    }
    applyBundledMongoEnv()
    runNodeScript(join(root, 'server', 'src', 'prefetch-db.js'), [], join(root, 'server'))
    stepOk('Database engine ready')
    progress('Creating admin login and sample products…')
    runNodeScript(join(root, 'server', 'src', 'seed.js'), [], join(root, 'server'))
    stepOk('Admin user and sample data created')
  }

  writeFileSync(join(root, '.setup-complete'), new Date().toISOString())
  if (!alreadyInstalled) {
    mkdirSync(join(root, 'data'), { recursive: true })
    writeFileSync(join(root, 'data/.shop-in-use'), new Date().toISOString())
  }

  progress('Optional: local hostname (bappistores)…')
  try {
    runNodeScript(join(root, 'scripts', 'configure-hostname.mjs'), [], root)
  } catch (err) {
    progress(`Hostname step skipped: ${err.message}`)
  }

  const url = appUrl(5001)

  banner('SETUP FINISHED SUCCESSFULLY')
  progress(`Open in browser: ${url}`)
  progress('Login: admin@bappi.com  /  Password: admin123')
  if (isWin) {
    progress('Next: double-click START.bat every day.')
  } else {
    progress('Next: double-click START.command every day.')
  }
  progress('Your data is saved in data/mongodb (do not delete that folder).')
}

try {
  main()
} catch (err) {
  fail(err.message || String(err))
  console.error('\n========================================')
  console.error('  Setup failed')
  console.error('========================================\n')
  console.error(err.message || String(err))
  if (err.stack) console.error(err.stack)
  progress('See setup-log.txt in this folder for the full log.')
  process.exit(1)
}
