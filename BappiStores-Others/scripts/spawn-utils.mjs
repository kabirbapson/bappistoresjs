/**
 * Run child processes without shell:true (avoids DEP0190 and spawn issues on Windows).
 */
import { spawnSync } from 'child_process'
import { existsSync } from 'fs'
import { dirname, join } from 'path'
import { getNodeExe } from './node-runtime.mjs'

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
          'Install Node.js LTS from https://nodejs.org (or use the offline share zip with bundled/nodejs).\n' +
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

function resolveNpmCli() {
  const nodeExe = getNodeExe()
  const candidates = [join(dirname(nodeExe), 'node_modules', 'npm', 'bin', 'npm-cli.js')]
  for (const path of candidates) {
    if (existsSync(path)) return { nodeExe, npmCli: path }
  }
  return null
}

export function runNpm(args, cwd) {
  const viaNode = resolveNpmCli()
  if (viaNode) {
    return runSpawn(viaNode.nodeExe, [viaNode.npmCli, ...args], { cwd })
  }

  if (process.platform === 'win32') {
    return runSpawn('npm.cmd', args, { cwd })
  }
  return runSpawn('npm', args, { cwd })
}

export function runNodeScript(scriptPath, args = [], cwd) {
  return runSpawn(getNodeExe(), [scriptPath, ...args], { cwd })
}
