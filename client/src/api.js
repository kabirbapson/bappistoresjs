import axios from "axios";

/**
 * Dev: Vite proxies /api → local server.
 * Production (START.bat): Express serves UI + API on one port — use relative /api (works offline, no Wi‑Fi).
 */
const baseURL = import.meta.env.DEV
  ? "/api"
  : import.meta.env.VITE_API_URL || "/api";

const api = axios.create({
  baseURL,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("bappi_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/** After UPDATE or server/.env change, old tokens fail — sign in again instead of blank screens / 401 loops. */
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const url = error.config?.url || "";
    if (status === 401 && !url.includes("/auth/login")) {
      localStorage.removeItem("bappi_token");
      const path = window.location.pathname || "";
      if (!path.startsWith("/login")) {
        window.location.replace("/login");
      }
    }
    return Promise.reject(error);
  },
);

export default api;
