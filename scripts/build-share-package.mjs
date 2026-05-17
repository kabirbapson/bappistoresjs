/**
 * Creates BappiStores-Share/ — zip this folder and send to other computers.
 * Run: npm run build:share
 */
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const dest = join(root, 'BappiStores-Share')

const COPY_DIRS = ['client', 'server', 'scripts']

const COPY_FILES = [
  'package.json',
  'package-lock.json',
  'README.md',
  'SETUP.txt',
  'SETUP.bat',
  'START.bat',
  'CONFIGURE-HOSTNAME.bat',
  'SETUP.command',
  'START.command',
]

const SKIP_DIR_NAMES = new Set(['node_modules', 'dist', '.git', '.cursor', '.vscode'])

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

1. Install Node.js LTS from https://nodejs.org (if not already installed).

2. Windows: double-click SETUP.bat (wait until finished).
   Mac: double-click SETUP.command.

3. Windows: right-click CONFIGURE-HOSTNAME.bat → Run as administrator (once).

4. Every day: double-click START.bat (Windows) or START.command (Mac).

5. Browser: http://bappistores:5001
   Login: admin@bappi.com
   Password: admin123

More help: open SETUP.txt in this folder.

Do not delete the "data" folder after setup — your sales are saved there.
`,
)

console.log(`\nDone → ${dest}`)
console.log('Zip the BappiStores-Share folder and send it to other computers.\n')
