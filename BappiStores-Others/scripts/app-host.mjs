/** Local app hostname (maps to 127.0.0.1 via hosts file). */
export const APP_HOST = process.env.APP_HOST || 'bappistores'

export function appUrl(port = process.env.PORT || 5001) {
  return `http://${APP_HOST}:${port}`
}
