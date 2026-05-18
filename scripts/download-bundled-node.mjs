/**
 * Download portable Node.js Windows x64 for offline shop installs.
 */
import { createWriteStream, existsSync, mkdirSync, readdirSync, rmSync } from 'fs'
import { pipeline } from 'stream/promises'
import { execSync } from 'child_process'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { progress } from './progress.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const NODE_VERSION = process.env.BAPPI_NODE_VERSION || '20.18.0'
const destDir = join(root, 'bundled', 'nodejs')
const zipName = `node-v${NODE_VERSION}-win-x64.zip`
const zipPath = join(root, 'bundled', zipName)
const url = `https://nodejs.org/dist/v${NODE_VERSION}/${zipName}`

if (process.platform !== 'win32') {
  progress('Skipping bundled Node download (build machine is not Windows).')
  progress('Shop zip for Windows should be built on a Windows PC, or install Node on each shop PC.')
  process.exit(0)
}

mkdirSync(join(root, 'bundled'), { recursive: true })

if (existsSync(join(destDir, 'node.exe'))) {
  progress(`Bundled Node.js ${NODE_VERSION} already present`)
  process.exit(0)
}

progress(`Downloading Node.js ${NODE_VERSION} Windows x64 (~30MB)…`)

const res = await fetch(url)
if (!res.ok) {
  throw new Error(`Failed to download Node.js: ${res.status} ${res.statusText}`)
}
await pipeline(res.body, createWriteStream(zipPath))

progress('Extracting Node.js…')
const extractTo = join(root, 'bundled', '_node-extract')
if (existsSync(extractTo)) rmSync(extractTo, { recursive: true, force: true })
mkdirSync(extractTo, { recursive: true })

execSync(
  `powershell -NoProfile -Command "Expand-Archive -LiteralPath '${zipPath.replace(/'/g, "''")}' -DestinationPath '${extractTo.replace(/'/g, "''")}' -Force"`,
  { stdio: 'inherit' },
)

const folder = readdirSync(extractTo).find((n) => n.startsWith('node-v'))
if (!folder) throw new Error('Node extract folder not found')

if (existsSync(destDir)) rmSync(destDir, { recursive: true, force: true })
mkdirSync(destDir, { recursive: true })

for (const name of readdirSync(join(extractTo, folder))) {
  const src = join(extractTo, folder, name)
  const dst = join(destDir, name)
  execSync(`powershell -NoProfile -Command "Copy-Item -LiteralPath '${src.replace(/'/g, "''")}' -Destination '${dst.replace(/'/g, "''")}' -Recurse -Force"`, {
    stdio: 'pipe',
  })
}

rmSync(extractTo, { recursive: true, force: true })

if (!existsSync(join(destDir, 'node.exe'))) {
  throw new Error('bundled/nodejs/node.exe missing after extract')
}

progress(`Bundled Node.js ready in bundled/nodejs/ (${NODE_VERSION})`)
