/**
 * Quick check: can mongod.exe run on this PC?
 */
import { mkdirSync, rmSync } from 'fs'
import { dirname, join } from 'path'
import { spawn, spawnSync } from 'child_process'
import { fileURLToPath } from 'url'
import { findBundledMongod } from './find-bundled-mongod.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const mongod = findBundledMongod(root)

console.log('Folder:', root)
if (!mongod) {
  console.error('\nFAIL: bundled/mongod.exe not found.')
  console.error('Use the full BappiStores-Share zip.')
  process.exit(1)
}

console.log('mongod:', mongod)

const ver = spawnSync(mongod, ['--version'], { encoding: 'utf8', windowsHide: true, timeout: 30000 })
if (ver.status !== 0) {
  console.error('\nFAIL: mongod.exe blocked or broken.')
  console.error('Add this folder to Windows Defender exclusions and try again.')
  if (ver.stderr) console.error(ver.stderr)
  process.exit(1)
}

console.log('\nOK:', ver.stdout.trim().split('\n')[0])

const dbPath = join(root, 'data', 'mongodb-test')
mkdirSync(dbPath, { recursive: true })

await new Promise((resolve, reject) => {
  let output = ''
  const proc = spawn(
    mongod,
    ['--dbpath', dbPath, '--port', '27099', '--bind_ip', '127.0.0.1'],
    { windowsHide: true },
  )
  const timer = setTimeout(() => {
    proc.kill('SIGTERM')
    if (/waiting for connections/i.test(output)) {
      console.log('\nPASS: MongoDB engine can start on this PC.')
      console.log('If START.bat still fails, run REPAIR-DATABASE.bat then START.bat.')
      resolve()
    } else {
      reject(new Error(`mongod output:\n${output.slice(-1500) || '(no output)'}`))
    }
  }, 12000)

  proc.stdout?.on('data', (chunk) => {
    output += chunk.toString()
  })
  proc.stderr?.on('data', (chunk) => {
    output += chunk.toString()
  })
  proc.on('error', reject)
  proc.on('exit', (code) => {
    clearTimeout(timer)
    if (/waiting for connections/i.test(output)) {
      console.log('\nPASS: MongoDB engine can start on this PC.')
      resolve()
    } else {
      reject(new Error(`mongod exited (${code}).\n${output.slice(-1500)}`))
    }
  })
}).finally(() => {
  try {
    rmSync(dbPath, { recursive: true, force: true })
  } catch {
    /* ignore */
  }
})