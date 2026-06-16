import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '/api';

/**
 * Axios instance. `withCredentials` lets the httpOnly refresh cookie flow.
 * The access token is held in memory (see auth store) and injected per request.
 */
export const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
});

let accessToken = null;
let onUnauthorized = null;

export function setAccessToken(token) {
  accessToken = token;
}
export function getAccessToken() {
  return accessToken;
}
export function setOnUnauthorized(fn) {
  onUnauthorized = fn;
}

api.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

// ---- Transparent access-token refresh on 401 ----
let refreshing = null;

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    const status = error.response?.status;

    // Never run refresh+replay for the auth endpoints themselves. A failed
    // login/signup must surface its own 401 instead of silently restoring a
    // stale session from a leftover refresh cookie; refresh/logout must not
    // recurse into themselves.
    const isAuthFlow =
      /\/auth\/(login|signup|logout|refresh|forgot-password|reset-password)(\b|\/|$)/.test(
        original?.url ?? ''
      );

    // Try a single refresh + replay.
    if (status === 401 && original && !original._retry && !isAuthFlow) {
      original._retry = true;
      try {
        refreshing = refreshing || api.post('/auth/refresh');
        const { data } = await refreshing;
        refreshing = null;
        const newToken = data?.data?.accessToken;
        if (newToken) {
          accessToken = newToken;
          original.headers.Authorization = `Bearer ${newToken}`;
          return api(original);
        }
      } catch {
        refreshing = null;
        onUnauthorized?.();
      }
    }
    return Promise.reject(error);
  }
);

/** Normalise an axios error into a readable message. */
export function apiError(error) {
  return (
    error?.response?.data?.error?.message ||
    error?.response?.data?.message ||
    error?.message ||
    'Something went wrong'
  );
}
