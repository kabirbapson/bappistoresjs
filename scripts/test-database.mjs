/**
 * Quick check: can mongod.exe run on this PC?
 */
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { analyzeInstallPath, formatInstallPathWarning } from './install-path.mjs'
import { findBundledMongod } from './find-bundled-mongod.mjs'
import { verifyMongodBinary, verifyMongodStarts } from './verify-database.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

async function main() {
  const analysis = analyzeInstallPath(root)
  console.log('Folder:', analysis.path)
  if (analysis.risky) {
    console.warn(formatInstallPathWarning(analysis))
  }

  const mongod = findBundledMongod(root)
  if (!mongod) {
    throw new Error('bundled/mongod.exe not found.\nUse the full BappiStores-Share zip.')
  }

  console.log('mongod:', mongod)
  console.log('\nOK:', await verifyMongodBinary(mongod))
  await verifyMongodStarts(mongod)
  console.log('\nPASS: MongoDB engine can start on this PC.')
  console.log('If START.bat still fails, run REPAIR-DATABASE.bat then START.bat.')
}

main().catch((err) => {
  console.error('\nFAIL:', err.message || err)
  process.exit(1)
})
