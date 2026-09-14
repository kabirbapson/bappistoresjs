import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { getProjectRoot } from './node-runtime.mjs'

function appHostFromServerEnv() {
  try {
    const envPath = join(getProjectRoot(), 'server', '.env')
    if (!existsSync(envPath)) return null
    const match = readFileSync(envPath, 'utf8').match(/^APP_HOST=(.+)$/m)
    return match ? match[1].trim() : null
  } catch {
    return null
  }
}

/** Local app hostname (maps to 127.0.0.1 via hosts file). */
export const APP_HOST = process.env.APP_HOST || appHostFromServerEnv() || 'ashukandashman'

export function appUrl(port = process.env.PORT || 5001) {
  return `http://${APP_HOST}:${port}`
}
