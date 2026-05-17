/**
 * Run child processes without shell:true (avoids DEP0190 and spawn issues on Windows).
 */
import { spawnSync } from 'child_process'
import { existsSync } from 'fs'
import { dirname, join } from 'path'

let cachedNpm

export function resolveNpm() {
  if (cachedNpm) return cachedNpm
  if (process.platform !== 'win32') {
    cachedNpm = 'npm'
    return cachedNpm
  }
  const besideNode = join(dirname(process.execPath), 'npm.cmd')
  if (existsSync(besideNode)) {
    cachedNpm = besideNode
    return cachedNpm
  }
  const where = spawnSync('where.exe', ['npm.cmd'], {
    encoding: 'utf8',
    shell: false,
    windowsHide: true,
  })
  if (where.status === 0 && where.stdout?.trim()) {
    cachedNpm = where.stdout.trim().split(/\r?\n/)[0].trim()
    return cachedNpm
  }
  cachedNpm = 'npm.cmd'
  return cachedNpm
}

export function runSpawn(command, args, { cwd, env = process.env } = {}) {
  const result = spawnSync(command, args, {
    cwd,
    env,
    stdio: 'inherit',
    shell: false,
    windowsHide: true,
  })

  if (result.error) {
    const err = result.error
    if (err.code === 'ENOENT') {
      throw new Error(
        `Could not run "${command}".\n` +
          'Install Node.js LTS from https://nodejs.org and restart the PC.\n' +
          `Details: ${err.message}`,
      )
    }
    throw err
  }

  if (result.status !== 0) {
    throw new Error(`Command failed (exit ${result.status}): ${command} ${args.join(' ')}`)
  }

  return result.status
}

export function runNpm(args, cwd) {
  return runSpawn(resolveNpm(), args, { cwd })
}

export function runNodeScript(scriptPath, args = [], cwd) {
  return runSpawn(process.execPath, [scriptPath, ...args], { cwd })
}
