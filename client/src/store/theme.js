import { create } from 'zustand';

const KEY = 'tms-theme';
const DARK_BG = '#0a0e1a';
const LIGHT_BG = '#f5f7fb';

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

function initial() {
  try {
    const t = localStorage.getItem(KEY);
    if (t === 'dark' || t === 'light') return t;
  } catch {
    /* ignore */
  }
  return 'dark';
}

/** Persisted light/dark theme. The pre-paint script in index.html sets the
 * initial class; this store keeps React state + the DOM in sync on toggle. */
export const useTheme = create((set, get) => ({
  theme: initial(),

  setTheme: (theme) => {
    try {
      localStorage.setItem(KEY, theme);
    } catch {
      /* ignore */
    }
    apply(theme);
    set({ theme });
  },

  toggle: () => get().setTheme(get().theme === 'dark' ? 'light' : 'dark'),
}));
