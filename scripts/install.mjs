/**
 * One-time installer: config files, npm install (root + client + server), seed data.
 * Run: node scripts/install.mjs   OR   double-click SETUP.bat / SETUP.command
 */
import { copyFileSync, existsSync, readdirSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { appUrl } from './app-host.mjs'
import { runNodeScript, runNpm } from './spawn-utils.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const isWin = process.platform === 'win32'

function log(msg) {
  console.log(msg)
}

function ensureEnv(exampleRel, targetRel) {
  const example = join(root, exampleRel)
  const target = join(root, targetRel)
  if (existsSync(target)) {
    log(`  ✓ ${targetRel} (already exists)`)
    return
  }
  if (!existsSync(example)) {
    throw new Error(`Missing ${exampleRel}`)
  }
  copyFileSync(example, target)
  log(`  ✓ Created ${targetRel}`)
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
        'Download LTS from https://nodejs.org then run setup again.',
    )
  }

  log('\n========================================')
  log('  Bappi Stores — automatic setup')
  log('========================================\n')

  log('Step 1/5 — Config files')
  ensureEnv('server/.env.example', 'server/.env')
  ensureEnv('client/.env.example', 'client/.env')

  log('\nStep 2/5 — Install packages (root)')
  runNpm(['install'], root)

  log('\nStep 3/5 — Install packages (client)')
  runNpm(['install'], join(root, 'client'))

  log('\nStep 4/5 — Install packages (server)')
  runNpm(['install'], join(root, 'server'))

  const alreadyInstalled =
    existsSync(join(root, '.setup-complete')) || hasPersistedShopData()

  if (alreadyInstalled) {
    log('\nStep 5/5 — Shop data found (skipping sample seed)')
    log('  Your existing sales, products, and customers are kept.')
    log('  For a new version in this folder, use UPDATE.bat instead of SETUP.')
  } else {
    log('\nStep 5/5 — Admin login + sample products (first install only)')
    runNodeScript(join(root, 'server', 'src', 'seed.js'), [], join(root, 'server'))
  }

  writeFileSync(join(root, '.setup-complete'), new Date().toISOString())

  log('\nOptional — Local hostname (bappistores)')
  try {
    runNodeScript(join(root, 'scripts', 'configure-hostname.mjs'), [], root)
  } catch (err) {
    log(`  (skipped: ${err.message})`)
  }

  const url = appUrl(5001)

  log('\n========================================')
  log('  Setup finished successfully!')
  log('========================================\n')
  log('Login:  admin@bappi.com')
  log('Password: admin123')
  log('')
  if (isWin) {
    log('To open the shop app: double-click  START.bat')
  } else {
    log('To open the shop app: double-click  START.command')
  }
  log('')
  log(`Browser address: ${url}`)
  log('(Run CONFIGURE-HOSTNAME.bat as Admin once if that link does not open)')
  log('')
  log('Your data is saved in the  data/mongodb  folder.')
  log('Product photos are in  server/uploads .')
  log('Before updates: double-click BACKUP.bat')
  log('To install updates: double-click UPDATE.bat (not SETUP)')
  log('')
}

try {
  main()
} catch (err) {
  console.error('\n========================================')
  console.error('  Setup failed')
  console.error('========================================\n')
  console.error(err.message || String(err))
  if (err.stack) console.error(err.stack)
  process.exit(1)
}
