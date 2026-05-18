/**
 * Pre-download MongoDB for offline shop installs (run during build:share on dev PC).
 */
import { copyFileSync, existsSync, mkdirSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { progress } from './progress.mjs'
import { findBundledMongod } from './find-bundled-mongod.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const version = process.env.MONGOMS_VERSION || '7.0.14'
const cacheDir = join(root, 'bundled', 'mongodb-cache')

mkdirSync(join(root, 'bundled'), { recursive: true })

process.chdir(join(root, 'server'))
process.env.MONGOMS_VERSION = version
process.env.MONGOMS_DOWNLOAD_DIR = cacheDir
process.env.MONGOMS_STARTUP_TIMEOUT = '600000'

progress(`Downloading MongoDB ${version} for offline installs (~600MB)…`)

const { MongoBinary } = await import('mongodb-memory-server-core')

const mongodPath = await MongoBinary.getPath({
  version,
  downloadDir: cacheDir,
})

progress(`MongoDB binary ready: ${mongodPath}`)

const bundledCopy = join(root, 'bundled', 'mongod.exe')
copyFileSync(mongodPath, bundledCopy)
writeFileSync(
  join(root, 'bundled', 'mongod-path.txt'),
  mongodPath,
  'utf8',
)

const verify = findBundledMongod(root)
if (!verify) {
  throw new Error('Could not verify bundled mongod.exe after download')
}
progress('Verified bundled/mongod.exe for offline setup')
