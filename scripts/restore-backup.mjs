/**
 * Restore database + uploads from a Backups\BappiStores-* folder.
 * Run: node scripts/restore-backup.mjs
 * Or: RESTORE-BACKUP.bat
 *
 * Close START.bat before running.
 */
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import readline from 'readline'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const backupsDir = join(root, 'Backups')

function listBackups() {
  if (!existsSync(backupsDir)) return []
  return readdirSync(backupsDir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && e.name.startsWith('BappiStores-'))
    .map((e) => join(backupsDir, e.name))
    .sort()
    .reverse()
}

function copyTree(src, dst) {
  if (!existsSync(src)) return false
  if (existsSync(dst)) rmSync(dst, { recursive: true, force: true })
  cpSync(src, dst, { recursive: true })
  return true
}

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close()
      resolve(answer.trim())
    })
  })
}

async function main() {
  console.log('\nBappi Stores — restore from backup\n')
  console.log('Close START.bat before continuing.\n')

  const backups = listBackups()
  if (backups.length === 0) {
    console.log(`No backups found in:\n  ${backupsDir}\n`)
    console.log('Run BACKUP.bat regularly to create backups.\n')
    process.exit(1)
  }

  console.log('Available backups (newest first):\n')
  backups.slice(0, 10).forEach((path, i) => {
    console.log(`  ${i + 1}. ${path.replace(backupsDir + '\\', '').replace(backupsDir + '/', '')}`)
  })

  const answer = await ask('\nEnter number to restore (or full folder path): ')
  let chosen = backups[Number(answer) - 1]
  if (!chosen && existsSync(answer)) chosen = answer
  if (!chosen && existsSync(join(backupsDir, answer))) chosen = join(backupsDir, answer)

  if (!chosen || !existsSync(chosen)) {
    console.log('\nInvalid choice.\n')
    process.exit(1)
  }

  const mongoSrc = join(chosen, 'data-mongodb')
  const uploadsSrc = join(chosen, 'server-uploads')

  if (!existsSync(mongoSrc)) {
    console.log('\nThis backup has no data-mongodb folder.\n')
    process.exit(1)
  }

  const confirm = await ask(
    `\nThis will REPLACE current data with:\n  ${chosen}\n\nType YES to continue: `,
  )
  if (confirm.toUpperCase() !== 'YES') {
    console.log('\nCancelled.\n')
    process.exit(0)
  }

  const mongoDst = join(root, 'data/mongodb')
  const uploadsDst = join(root, 'server/uploads')

  mkdirSync(join(root, 'data'), { recursive: true })
  console.log('\nRestoring database…')
  copyTree(mongoSrc, mongoDst)

  if (existsSync(uploadsSrc)) {
    console.log('Restoring product photos…')
    copyTree(uploadsSrc, uploadsDst)
  }

  console.log('\nRestore complete. Run START.bat.\n')
}

main().catch((err) => {
  console.error(err.message || err)
  process.exit(1)
})
