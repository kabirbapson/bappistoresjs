/**
 * Copy database + product photos to Backups/ folder.
 * Run: npm run backup   OR   double-click BACKUP.bat
 */
import { cpSync, existsSync, mkdirSync, readdirSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
const dest = join(root, 'Backups', `BappiStores-${stamp}`)

const sources = [
  { from: join(root, 'data/mongodb'), label: 'data/mongodb (sales, products, customers)' },
  { from: join(root, 'server/uploads'), label: 'server/uploads (product photos)' },
]

function copyTree(src, dst) {
  mkdirSync(dst, { recursive: true })
  for (const entry of readdirSync(src, { withFileTypes: true })) {
    const from = join(src, entry.name)
    const to = join(dst, entry.name)
    if (entry.isDirectory()) {
      copyTree(from, to)
    } else if (entry.isFile()) {
      cpSync(from, to)
    }
  }
}

console.log('\nBappi Stores — backup\n')

let copied = 0
for (const { from, label } of sources) {
  if (!existsSync(from)) {
    console.log(`  skip ${label} (folder not found yet)`)
    continue
  }
  const name = from.includes('mongodb') ? 'data-mongodb' : 'server-uploads'
  const target = join(dest, name)
  console.log(`  copying ${label}…`)
  copyTree(from, target)
  copied += 1
}

if (copied === 0) {
  console.log('\nNothing to back up yet. Use the app first, then run backup again.\n')
  process.exit(0)
}

console.log(`\nBackup saved:\n  ${dest}\n`)
console.log('Copy this folder to USB or cloud before installing an update.\n')
