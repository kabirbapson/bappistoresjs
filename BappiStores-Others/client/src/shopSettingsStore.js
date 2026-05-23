import { create } from 'zustand'
import api from './api'

export const DEFAULT_SHOP_SETTINGS = {
  shopName: '',
  addresses: [],
  phones: [],
  logoUrl: '/logo.png',
  receiptTitle: 'SALES INVOICE',
  receiptFooterArabic: '',
  logoIncludesReceiptHeader: false,
}

export function displayShopName(settings) {
  return settings?.shopName?.trim() || 'My Shop'
}

export const useShopSettingsStore = create((set, get) => ({
  settings: null,
  loaded: false,
  loading: false,

  load: async () => {
    if (get().loading) return get().settings
    set({ loading: true })
    try {
      const { data } = await api.get('/settings')
      set({ settings: data, loaded: true, loading: false })
      const title = data.shopName?.trim()
      if (title) document.title = title
      return data
    } catch {
      set({ settings: DEFAULT_SHOP_SETTINGS, loaded: true, loading: false })
      return DEFAULT_SHOP_SETTINGS
    }
  },

  save: async (payload) => {
    const { data } = await api.put('/settings', payload)
    set({ settings: data, loaded: true })
    const title = data.shopName?.trim()
    if (title) document.title = title
    return data
  },

  uploadLogo: async (file) => {
    const form = new FormData()
    form.append('image', file)
    const { data } = await api.post('/settings/logo', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    set({ settings: data, loaded: true })
    return data
  },
}))
