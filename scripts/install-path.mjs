/**
 * Install folder checks — Documents/OneDrive/Desktop corrupt MongoDB data.
 */
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

export const RECOMMENDED_WIN_PATH = 'C:\\BappiStores'

export function analyzeInstallPath(installRoot = root) {
  const normalized = installRoot.replace(/\\/g, '/').toLowerCase()
  const reasons = []

  if (normalized.includes('onedrive')) {
    reasons.push('OneDrive sync deletes or locks database files (WiredTiger journal).')
  }
  if (normalized.includes('/documents/') || normalized.includes('/my documents/')) {
    reasons.push('Documents is often synced to OneDrive — database corruption is common there.')
  }
  if (normalized.includes('/desktop/')) {
    reasons.push('Desktop is not a safe place for the live database.')
  }

  return {
    path: installRoot,
    risky: reasons.length > 0,
    reasons,
    recommended:
      process.platform === 'win32' ? RECOMMENDED_WIN_PATH : join('/Applications', 'BappiStores'),
  }
}

export function formatInstallPathWarning(analysis) {
  if (!analysis.risky) return ''
  const lines = [
    '',
    '*** UNSAFE INSTALL FOLDER ***',
    `Current: ${analysis.path}`,
    '',
    ...analysis.reasons.map((r) => `  - ${r}`),
    '',
    `Move the whole folder to: ${analysis.recommended}`,
    'Then run SETUP.bat again from the new location.',
    '',
  ]
  return lines.join('\n')
}

/**
 * @param {{ strict?: boolean }} opts — strict=true throws on risky path (shop offline zip)
 */
export function assertSafeInstallPath(installRoot = root, { strict = false } = {}) {
  const analysis = analyzeInstallPath(installRoot)
  if (!analysis.risky) return analysis

  if (process.env.BAPPI_ALLOW_RISKY_PATH === '1') {
    return analysis
  }

  const warning = formatInstallPathWarning(analysis)
  if (strict) {
    throw new Error(
      warning +
        'SETUP stopped to protect your sales data.\n' +
        'IT: unzip to C:\\BappiStores before running SETUP.bat.',
    )
  }

  return { ...analysis, warning }
}
