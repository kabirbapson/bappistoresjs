/**
 * Creates BappiStores-Share/ — zip this folder and send to other computers.
 * Run: npm run build:share
 */
import { spawnSync } from 'child_process'
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const isWin = process.platform === 'win32'
const dest = join(root, 'BappiStores-Share')

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
  'BappiStores-Share',
  'Backups',
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
      cpSync(join(src, entry.name), join(dst, entry.name))
    }
  }
}

console.log('Building share package...\n')

console.log('Step 1 — Build shop UI (client/dist)…')
const build = spawnSync(isWin ? 'npm.cmd' : 'npm', ['run', 'build', '--prefix', 'client'], {
  cwd: root,
  stdio: 'inherit',
  shell: isWin,
})
if (build.status !== 0) {
  console.error('\nBuild failed. Fix errors above, then run npm run build:share again.\n')
  process.exit(1)
}

console.log('\nStep 2 — Copy files to BappiStores-Share/…\n')

if (existsSync(dest)) {
  rmSync(dest, { recursive: true, force: true })
}
mkdirSync(dest, { recursive: true })

for (const file of COPY_FILES) {
  const src = join(root, file)
  if (existsSync(src)) {
    cpSync(src, join(dest, file))
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

writeFileSync(
  join(dest, 'READ-ME-FIRST.txt'),
  `BAPPI STORES — READ THIS FIRST
==============================

NEW COMPUTER (first time)
-------------------------
1. Install Node.js LTS from https://nodejs.org
2. Double-click SETUP.bat (Windows) or SETUP.command (Mac)
3. Once: CONFIGURE-HOSTNAME.bat as Administrator (Windows)
4. Every day: START.bat / START.command
5. Browser: http://bappistores:5001
   Login: admin@bappi.com / admin123

ALREADY USING BAPPI STORES? (software update)
---------------------------------------------
Read UPGRADE.txt — use UPDATE.bat, NOT SETUP.bat.
Your sales stay in the  data/mongodb  folder.
Run BACKUP.bat before updating (recommended).

Do NOT delete:
  data/mongodb     — all sales, products, customers, debts
  server/uploads   — product photos you uploaded

More help: SETUP.txt and UPGRADE.txt
`,
)

console.log(`\nDone → ${dest}`)
console.log('Zip the BappiStores-Share folder and send it to shop computers.')
console.log('Do not include node_modules or data/ in the zip — setup creates those.\n')
