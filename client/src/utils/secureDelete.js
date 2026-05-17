import api from '../api'

export function deleteWithPassword(url, password) {
  return api.delete(url, { data: { password } })
}
