import axios from "axios";

const appHost = import.meta.env.VITE_APP_HOST || "bappistores";
const defaultPort = import.meta.env.VITE_API_PORT || "5001";

const baseURL =
  import.meta.env.DEV
    ? "/api"
    : import.meta.env.VITE_API_URL || `http://${appHost}:${defaultPort}/api`;

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
