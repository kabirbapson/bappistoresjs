/**
 * One-time installer: config files, npm install (root + client + server), seed data.
 * Run: node scripts/install.mjs   OR   double-click SETUP.bat / SETUP.command
 */
import { spawnSync } from 'child_process'
import { copyFileSync, existsSync, writeFileSync } from 'fs'
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

function ensureEnv(exampleRel, targetRel) {
  const example = join(root, exampleRel)
  const target = join(root, targetRel)
  if (existsSync(target)) {
    log(`  ✓ ${targetRel} (already exists)`)
    return
  }
  if (!existsSync(example)) {
    fail(`Missing ${exampleRel}`)
  }
  copyFileSync(example, target)
  log(`  ✓ Created ${targetRel}`)
}

const nodeMajor = Number.parseInt(process.versions.node.split('.')[0], 10)
if (nodeMajor < 20) {
  fail(
    `Node.js 20 or newer is required (you have ${process.versions.node}).\n` +
      'Download LTS from https://nodejs.org then run setup again.',
  )
}

log('\n========================================')
log('  Bappi Stores — automatic setup')
log('========================================\n')

log('Step 1/4 — Config files')
ensureEnv('server/.env.example', 'server/.env')
ensureEnv('client/.env.example', 'client/.env')

log('\nStep 2/4 — Install packages (root)')
npm(['install'], root)

log('\nStep 3/4 — Install packages (client + server)')
npm(['install'], join(root, 'client'))
npm(['install'], join(root, 'server'))

log('\nStep 4/4 — Admin login + sample products')
npm(['run', 'seed'], join(root, 'server'))

writeFileSync(join(root, '.setup-complete'), new Date().toISOString())

log('\nStep 5/5 — Local hostname (bappistores)')
spawnSync(process.execPath, ['scripts/configure-hostname.mjs'], {
  cwd: root,
  stdio: 'inherit',
})

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
  log('              (or run:  npm run start)')
}
log('')
log(`Browser address: ${url}`)
log('(Run CONFIGURE-HOSTNAME.bat as Admin once if that link does not open)')
log('')
log('Your data is saved in the  data/mongodb  folder.')
log('It stays after shutdown — tomorrow you will see yesterday\'s sales.')
log('Back up that folder to keep records safe.')
log('')
