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

export default api;
