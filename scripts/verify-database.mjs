/**
 * Verify bundled mongod can start (used after SETUP and by TEST-DATABASE.bat).
 */
import { mkdirSync, rmSync } from 'fs'
import { dirname, join } from 'path'
import { spawn, spawnSync } from 'child_process'
import { fileURLToPath } from 'url'
import { findBundledMongod } from './find-bundled-mongod.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

export async function verifyMongodBinary(mongod) {
  const ver = spawnSync(mongod, ['--version'], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 30000,
  })
  if (ver.status !== 0) {
    const status = ver.status
    const isMissingDll = status === 3221225781 || status === -1073741515
    const isIllegalInstruction = status === 3221225501 || status === -1073741795
    if (isMissingDll) {
      throw new Error(
        'mongod.exe requires Microsoft Visual C++ 2015-2022 Redistributable (exit ' + status + ').\n' +
        'Run bundled\\vc_redist.x64.exe or ensure vcruntime140.dll / msvcp140.dll are present.',
      )
    }
    if (isIllegalInstruction) {
      throw new Error(
        'mongod.exe crashed with illegal instruction (exit ' + status + ').\n' +
        'This PC processor does not support AVX instructions required by MongoDB 5.0+.',
      )
    }
    throw new Error(
      'mongod.exe blocked or missing.\n' +
        'Add this app folder to Windows Defender exclusions and restore mongod.exe if quarantined.',
    )
  }
  return ver.stdout?.trim().split('\n')[0] || 'mongod OK'
}

export async function verifyMongodStarts(mongod, { dbPath, port = 27099 } = {}) {
  const testDb = dbPath || join(root, 'data', 'mongodb-verify-test')
  mkdirSync(testDb, { recursive: true })

  return new Promise((resolve, reject) => {
    let output = ''
    let settled = false
    const proc = spawn(
      mongod,
      ['--dbpath', testDb, '--port', String(port), '--bind_ip', '127.0.0.1'],
      { windowsHide: true },
    )

    const finish = (ok, err) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      try {
        proc.kill('SIGTERM')
      } catch {
        /* ignore */
      }
      if (ok) resolve()
      else reject(err)
    }

    const timer = setTimeout(() => {
      finish(
        /waiting for connections/i.test(output),
        new Error(`mongod did not become ready.\n${output.slice(-1500) || '(no output)'}`),
      )
    }, 20000)

    const onChunk = (c) => {
      output += c.toString()
      if (/waiting for connections/i.test(output)) {
        finish(true)
      }
    }

    proc.stdout?.on('data', onChunk)
    proc.stderr?.on('data', onChunk)
    proc.on('error', (err) => finish(false, err))
    proc.on('exit', (code) => {
      if (/waiting for connections/i.test(output)) {
        finish(true)
      } else if (!settled) {
        finish(false, new Error(`mongod exited (${code}).\n${output.slice(-1500)}`))
      }
    })
  }).finally(() => {
    try {
      rmSync(testDb, { recursive: true, force: true })
    } catch {
      /* ignore */
    }
  })
}

export async function verifyDatabaseFolder(mongod, dbPath, port = 27017) {
  await verifyMongodStarts(mongod, { dbPath, port })
}

export async function verifyShopDatabase(installRoot = root) {
  const mongod = findBundledMongod(installRoot)
  if (!mongod) {
    throw new Error('bundled/mongod.exe not found — use the full BappiStores-Share zip.')
  }
  await verifyMongodBinary(mongod)
  await verifyMongodStarts(mongod)
  return { ok: true, mongod }
}
