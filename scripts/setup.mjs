import { copyFileSync, existsSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

function ensureEnv(exampleRel, targetRel) {
  const example = join(root, exampleRel)
  const target = join(root, targetRel)
  if (existsSync(target)) {
    console.log(`  skip ${targetRel} (already exists)`)
    return
  }
  if (!existsSync(example)) {
    console.warn(`  missing ${exampleRel}`)
    return
  }
  copyFileSync(example, target)
  console.log(`  created ${targetRel}`)
}

console.log('Bappi Stores — setup\n')
console.log('Config files:')
ensureEnv('server/.env.example', 'server/.env')
ensureEnv('client/.env.example', 'client/.env')
console.log('\nNext:')
console.log('  npm run install:all')
console.log('  npm run seed')
console.log('  npm run dev')
console.log('\nProduction (one URL for UI + API):')
console.log('  npm run start')
console.log('  Open http://localhost:5001')
