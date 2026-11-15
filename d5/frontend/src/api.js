import axios from "axios";

// D9: the JWT is kept in sessionStorage (cleared when the tab closes) and sent
// as "Authorization: Bearer ..." on every request. The server decides the role.
const KEY = "rosca.session";

export function loadSession() {
  try {
    return JSON.parse(sessionStorage.getItem(KEY)) || null;
  } catch {
    return null;
  }
}
export function saveSession(session) {
  if (session) sessionStorage.setItem(KEY, JSON.stringify(session));
  else sessionStorage.removeItem(KEY);
}

let onUnauthorized = () => {};
export function setUnauthorizedHandler(handler) {
  onUnauthorized = handler;
}

export const client = axios.create({
  baseURL: (import.meta.env.VITE_API_URL || "http://localhost:3000").replace(
    /\/$/,
    "",
  ),
  timeout: 10000,
});
let retryAt = 0;

client.interceptors.request.use((config) => {
  if (Date.now() < retryAt) {
    throw new Error(
      "Too many requests. Please wait a minute before trying again.",
    );
  }
  const token = loadSession()?.token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (axios.isCancel(error)) return Promise.reject(error);
    if (error.response?.status === 401 && error.config?.url !== "/login") {
      // Expired or invalid token: fail safe and return to the login form.
      saveSession(null);
      onUnauthorized();
    }
    if (error.response?.status === 429) {
      const retry = error.response.headers?.["retry-after"];
      const delay =
        retry && Number.isFinite(Number(retry))
          ? Number(retry) * 1000
          : Date.parse(retry) - Date.now();
      retryAt =
        Date.now() + Math.max(60000, Number.isFinite(delay) ? delay : 0);
    }
    const data = error.response?.data;
    const message =
      data?.errors?.join(" ") ||
      data?.error ||
      (error.response
        ? `Request failed (${error.response.status}).`
        : error.config
          ? "Cannot reach the API. Check the backend address and CORS_ORIGINS."
          : error.message);
    return Promise.reject(new Error(message));
  },
);
