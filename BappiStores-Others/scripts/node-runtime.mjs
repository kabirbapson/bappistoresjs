/**
 * Prefer portable Node/npm shipped inside bundled/ (offline shop installs).
 */
import { existsSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

export function getProjectRoot() {
  return root
}

export function getBundledNodeDir() {
  return join(root, 'bundled', 'nodejs')
}

export function getNodeExe() {
  const bundled = join(getBundledNodeDir(), 'node.exe')
  if (existsSync(bundled)) return bundled
  return process.execPath
}

export function getNpmForSpawn() {
  const nodeExe = getNodeExe()
  if (nodeExe !== process.execPath) {
    const npmCmd = join(dirname(nodeExe), 'npm.cmd')
    if (existsSync(npmCmd)) return npmCmd
  }
  if (process.platform === 'win32') {
    const beside = join(dirname(process.execPath), 'npm.cmd')
    if (existsSync(beside)) return beside
    return 'npm.cmd'
  }
  return 'npm'
}

export function isOfflineBundle() {
  return existsSync(join(root, 'bundled', 'OFFLINE.txt'))
}
