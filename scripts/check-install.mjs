/**
 * Pre-flight before SETUP — folder location + mongod binary.
 * Run: CHECK-INSTALL.bat
 */
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { analyzeInstallPath, formatInstallPathWarning } from './install-path.mjs'
import { isOfflineBundle } from './node-runtime.mjs'
import { verifyShopDatabase } from './verify-database.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

async function main() {
  console.log('')
  console.log('==================================================')
  console.log('  Bappi Stores — install pre-check')
  console.log('==================================================')
  console.log('')

  const analysis = analyzeInstallPath(root)
  console.log(`Folder: ${analysis.path}`)

  if (analysis.risky) {
    console.log(formatInstallPathWarning(analysis))
    if (isOfflineBundle() && process.env.BAPPI_ALLOW_RISKY_PATH !== '1') {
      console.error('STOP: Move the folder before SETUP (shop offline package).')
      process.exit(1)
    }
    console.log('Continuing with warning (dev mode or BAPPI_ALLOW_RISKY_PATH=1).')
  } else {
    console.log('OK: Install folder looks safe.')
  }

  console.log('')
  console.log('Testing database engine…')
  await verifyShopDatabase(root)
  console.log('')
  console.log('PASS: Ready for SETUP.bat')
  console.log('')
}

main().catch((err) => {
  console.error('')
  console.error('FAIL:', err.message || err)
  console.error('')
  console.error('Fix the issues above, then run SETUP.bat again.')
  process.exit(1)
})
