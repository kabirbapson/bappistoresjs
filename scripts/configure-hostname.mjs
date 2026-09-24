/**
 * Maps bappistores → 127.0.0.1 in the system hosts file so you can open http://bappistores:5001
 * Run with --write (admin on Windows / sudo on Mac). Called from install.mjs when possible.
 */
import { readFileSync, writeFileSync } from 'fs'
import { lookup } from 'dns/promises'
import { APP_HOST } from './app-host.mjs'

const IP = '127.0.0.1'
const ENTRY = `${IP}\t${APP_HOST}`

function hostsPath() {
  if (process.platform === 'win32') {
    return `${process.env.SystemRoot || 'C:\\Windows'}\\System32\\drivers\\etc\\hosts`
  }
  return '/etc/hosts'
}

async function hostResolves() {
  try {
    const result = await lookup(APP_HOST)
    return result.address === IP
  } catch {
    return false
  }
}

function hostsContains(text) {
  const pattern = new RegExp(`^\\s*${IP}\\s+${APP_HOST}\\s*$`, 'm')
  return pattern.test(text) || text.includes(APP_HOST)
}

function tryWriteHosts() {
  const path = hostsPath()
  let content = readFileSync(path, 'utf8')
  if (hostsContains(content)) {
    return { ok: true, already: true }
  }
  const suffix = content.endsWith('\n') ? '' : '\n'
  writeFileSync(path, `${content}${suffix}# Bappi Stores\n${ENTRY}\n`, 'utf8')
  return { ok: true, already: false }
}

const write = process.argv.includes('--write')

async function main() {
  if (await hostResolves()) {
    console.log(`  ✓ http://${APP_HOST} is ready on this computer`)
    return
  }

  if (write) {
    try {
      const result = tryWriteHosts()
      if (result.already) {
        console.log(`  ✓ hosts file already lists ${APP_HOST}`)
      } else {
        console.log(`  ✓ Added ${APP_HOST} → ${IP} to hosts file`)
      }
      if (await hostResolves()) {
        console.log(`  ✓ http://${APP_HOST} is ready`)
        return
      }
    } catch (err) {
      console.warn(`  Could not edit hosts file: ${err.message}`)
    }
  }

  console.log('')
  console.log(`  To use http://${APP_HOST} instead of localhost, run once:`)
  if (process.platform === 'win32') {
    console.log('    Right-click CONFIGURE-HOSTNAME.bat → Run as administrator')
  } else {
    console.log(`    sudo node scripts/configure-hostname.mjs --write`)
  }
  console.log('  Or open http://localhost:5001 — it still works.')
  console.log('')
}

main().catch((err) => {
  console.warn(err.message)
})
