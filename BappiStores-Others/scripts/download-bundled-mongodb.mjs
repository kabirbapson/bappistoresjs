/**
 * Pre-download MongoDB for offline shop installs (run during build:share on dev PC).
 */
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { progress } from './progress.mjs'
import { findBundledMongod } from './find-bundled-mongod.mjs'
import { runNodeScript } from './spawn-utils.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const version = process.env.MONGOMS_VERSION || '7.0.14'

progress(`Downloading MongoDB ${version} for offline installs (~600MB)…`)

runNodeScript(join(root, 'server', 'src', 'download-bundled-mongo.js'), [], join(root, 'server'))

const verify = findBundledMongod(root)
if (!verify) {
  throw new Error('Could not verify bundled/mongod.exe after download')
}
progress('Verified bundled/mongod.exe for offline setup')
