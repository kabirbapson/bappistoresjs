import { copyFileSync, existsSync } from 'fs'
import { spawnSync } from 'child_process'
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

// Ensure Visual C++ runtime DLLs and vc_redist.x64.exe are in bundled/
if (process.platform === 'win32') {
  const bundledDir = join(root, 'bundled')
  const sys32 = 'C:\\Windows\\System32'
  const vcDlls = [
    'vcruntime140.dll',
    'vcruntime140_1.dll',
    'msvcp140.dll',
    'msvcp140_1.dll',
    'msvcp140_2.dll',
    'msvcp140_atomic_wait.dll',
    'msvcp140_codecvt_ids.dll',
  ]
  for (const dll of vcDlls) {
    const src = join(sys32, dll)
    const dst = join(bundledDir, dll)
    if (existsSync(src) && !existsSync(dst)) {
      try {
        copyFileSync(src, dst)
      } catch {
        /* ignore */
      }
    }
  }
  const redistPath = join(bundledDir, 'vc_redist.x64.exe')
  if (!existsSync(redistPath)) {
    try {
      progress('Downloading Microsoft Visual C++ Redistributable (vc_redist.x64.exe)…')
      spawnSync('curl.exe', ['-L', '-o', redistPath, 'https://aka.ms/vs/17/release/vc_redist.x64.exe'], {
        windowsHide: true,
      })
    } catch {
      /* ignore */
    }
  }
}

