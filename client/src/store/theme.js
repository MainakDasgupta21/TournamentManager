import { create } from 'zustand';

const DARK_BG = '#0a0e1a';
const LIGHT_BG = '#f5f7fb';
const DEFAULT_THEME = 'dark';

/** Reflect the chosen theme onto <html> (class + color-scheme + theme-color). */
function apply(theme) {
  if (typeof document === 'undefined') return;
  const dark = theme === 'dark';
  const el = document.documentElement;
  el.classList.toggle('dark', dark);
  el.style.colorScheme = dark ? 'dark' : 'light';
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', dark ? DARK_BG : LIGHT_BG);
}

/**
 * Light/dark theme state. Nothing is persisted on the client: for a signed-in
 * user the database is the source of truth (applied from the session on login),
 * and anonymous visitors simply get the default theme each visit. This store
 * only mirrors the current choice into React state + the DOM.
 */
export const useTheme = create((set) => ({
  theme: DEFAULT_THEME,

  setTheme: (theme) => {
    const next = theme === 'light' ? 'light' : 'dark';
    apply(next);
    set({ theme: next });
  },

  toggle: () => set((state) => {
    const next = state.theme === 'dark' ? 'light' : 'dark';
    apply(next);
    return { theme: next };
  }),

  /** Reset to the default (used on logout, so the next visitor starts clean). */
  reset: () => {
    apply(DEFAULT_THEME);
    set({ theme: DEFAULT_THEME });
  },
}));
