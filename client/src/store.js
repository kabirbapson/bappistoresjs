import { create } from "zustand";
import api from "./api";

export const useAuthStore = create((set) => ({
  user: null,
  token: localStorage.getItem("bappi_token"),
  loading: false,
  login: async (payload) => {
    set({ loading: true });
    const { data } = await api.post("/auth/login", payload);
    localStorage.setItem("bappi_token", data.token);
    set({ token: data.token, user: data.user, loading: false });
  },
  logout: () => {
    localStorage.removeItem("bappi_token");
    set({ token: null, user: null });
  },
}));
