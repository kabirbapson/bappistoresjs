import { existsSync, readdirSync } from 'fs'
import { join } from 'path'
import { getProjectRoot } from './node-runtime.mjs'

export function findBundledMongod(root = getProjectRoot()) {
  const direct = join(root, 'bundled', 'mongod.exe')
  if (existsSync(direct)) return direct

  const caches = [
    join(root, 'bundled', 'mongodb-cache'),
    join(root, 'bundled', 'mongodb'),
    join(root, 'data', 'mongodb-bin'),
  ]

  for (const cache of caches) {
    if (!existsSync(cache)) continue
    const found = findFileNamed(cache, 'mongod.exe', 8)
    if (found) return found
  }
  return null
}

function findFileNamed(dir, name, maxDepth, depth = 0) {
  if (depth > maxDepth) return null
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return null
  }
  for (const entry of entries) {
    const full = join(dir, entry.name)
    if (entry.isFile() && entry.name.toLowerCase() === name.toLowerCase()) {
      return full
    }
    if (entry.isDirectory()) {
      const inner = findFileNamed(full, name, maxDepth, depth + 1)
      if (inner) return inner
    }
  }
  return null
}
