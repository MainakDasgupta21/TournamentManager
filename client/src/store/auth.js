import { create } from 'zustand';
import { api, setAccessToken, setOnUnauthorized } from '@/lib/api';
import { useTheme } from '@/store/theme';

// Shared across all bootstrap callers so React StrictMode's double-mount (or any
// concurrent boot) runs at most one refresh and can't overwrite a good session
// with a superseded failure.
let bootstrapPromise = null;

/**
 * Auth state. The access token lives in memory (not localStorage) to reduce XSS
 * exposure; on a fresh load we silently try the refresh cookie to restore the
 * session.
 */
export const useAuth = create((set, get) => ({
  user: null,
  accessToken: null,
  status: 'idle', // idle | loading | authenticated | unauthenticated

  setSession: ({ user, accessToken }) => {
    setAccessToken(accessToken);
    // The server is the source of truth for the user's theme; apply it now.
    useTheme.getState().setTheme(user?.preferences?.theme ?? 'dark');
    set({ user, accessToken, status: 'authenticated' });
  },

  login: async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    get().setSession(data.data);
    return data.data.user;
  },

  /**
   * Public organiser self-signup. Creates a pending account but does NOT start
   * a session — the user can only sign in once a maintainer approves them.
   */
  signup: async (payload) => {
    const { data } = await api.post('/auth/signup', payload);
    return data.message;
  },

  logout: async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      /* ignore network errors on logout */
    }
    setAccessToken(null);
    useTheme.getState().reset();
    set({ user: null, accessToken: null, status: 'unauthenticated' });
  },

  /**
   * Change the signed-in user's password. The server bumps tokenVersion (signing
   * out other devices) and returns a fresh access token + refresh cookie, which
   * we adopt so the current session keeps working seamlessly.
   */
  changePassword: async ({ currentPassword, newPassword }) => {
    const { data } = await api.post('/auth/change-password', { currentPassword, newPassword });
    get().setSession(data.data);
    return data.message;
  },

  /** Request a password-reset email. Resolves to a generic message either way. */
  forgotPassword: async (email) => {
    const { data } = await api.post('/auth/forgot-password', { email });
    return data.message;
  },

  /** Complete a reset with the emailed token. Does not start a session. */
  resetPassword: async ({ token, newPassword }) => {
    const { data } = await api.post('/auth/reset-password', { token, newPassword });
    return data.message;
  },

  /** Called on app boot: restore session from the refresh cookie if present. */
  bootstrap: async () => {
    if (bootstrapPromise) return bootstrapPromise;
    set({ status: 'loading' });
    bootstrapPromise = (async () => {
      try {
        const { data } = await api.post('/auth/refresh');
        get().setSession(data.data);
      } catch {
        setAccessToken(null);
        set({ user: null, accessToken: null, status: 'unauthenticated' });
      } finally {
        bootstrapPromise = null;
      }
    })();
    return bootstrapPromise;
  },

  isManager: () => {
    const role = get().user?.role;
    return role === 'superadmin' || role === 'tournamentadmin';
  },

  isSuperAdmin: () => get().user?.role === 'superadmin',
}));

// When a refresh ultimately fails, clear the session.
setOnUnauthorized(() => {
  setAccessToken(null);
  useTheme.getState().reset();
  useAuth.setState({ user: null, accessToken: null, status: 'unauthenticated' });
});
