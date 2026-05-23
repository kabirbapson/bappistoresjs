/**
 * Live terminal progress + optional log file (for SETUP.bat / UPDATE.bat).
 */
import { appendFileSync, writeFileSync } from 'fs'

let logPath = null

export function initProgressLog(filePath) {
  logPath = filePath || null
  if (logPath) {
    writeFileSync(
      logPath,
      `Bappi Stores — ${new Date().toLocaleString()}\n${'='.repeat(50)}\n\n`,
      'utf8',
    )
  }
}

function emit(line = '') {
  process.stdout.write(`${line}\n`)
  if (logPath) {
    appendFileSync(logPath, `${line}\n`, 'utf8')
  }
}

export function progress(msg) {
  const time = new Date().toLocaleTimeString()
  emit(`[${time}] ${msg}`)
}

export function step(index, total, label) {
  emit('')
  emit('--------------------------------------------------')
  emit(`  STEP ${index} of ${total}: ${label}`)
  emit('--------------------------------------------------')
  emit('  Working… please keep this window open.')
  emit('')
}

export function stepOk(msg) {
  emit(`  Done: ${msg}`)
  emit('')
}

export function banner(title) {
  emit('')
  emit('==================================================')
  emit(`  ${title}`)
  emit('==================================================')
  emit('')
}

export function fail(msg) {
  const time = new Date().toLocaleTimeString()
  const line = `[${time}] FAILED: ${msg}`
  process.stderr.write(`${line}\n`)
  if (logPath) appendFileSync(logPath, `${line}\n`, 'utf8')
}
