import { create } from "zustand";
import api from "./api";

export const useAuthStore = create((set) => ({
  user: null,
  token: localStorage.getItem("bappi_token"),
  loading: false,
  login: async (payload) => {
    set({ loading: true });
    try {
      const { data } = await api.post("/auth/login", payload);
      localStorage.setItem("bappi_token", data.token);
      set({ token: data.token, user: data.user });
    } finally {
      set({ loading: false });
    }
  },
  logout: () => {
    localStorage.removeItem("bappi_token");
    set({ token: null, user: null });
  },
}));

const defaultBusinessProfile = {
  businessName: 'ASHUK & ASHMAN BEVERAGES',
  tagline: 'Farin Cikinku, Shine Namu...',
  logoUrl: '/newLogo.jpg',
  logoIncludesReceiptHeader: true,
  addresses: ['Shop No. 67 | Hauwa Sani Marshal Plaza, Malam Kato, Kano.', 'Shop No. 17 | NAKOWA Plaza Bayan Glo Olo Office, Kano.'],
  phones: ['07066381212', '08145173573'],
  receiptTitle: 'SALES INVOICE',
  receiptFooter: 'بالتوفيق والسلامة',
}

export const useBusinessProfileStore = create((set) => ({
  profile: defaultBusinessProfile,
  loaded: false,
  load: async () => {
    try {
      const { data } = await api.get('/business-profile')
      set({ profile: { ...defaultBusinessProfile, ...data }, loaded: true })
    } catch {
      set({ loaded: true })
    }
  },
  save: async (profile) => {
    const { data } = await api.put('/business-profile', profile)
    set({ profile: { ...defaultBusinessProfile, ...data }, loaded: true })
    return data
  },
  setLogoUrl: (logoUrl) => set((state) => ({ profile: { ...state.profile, logoUrl } })),
}))
