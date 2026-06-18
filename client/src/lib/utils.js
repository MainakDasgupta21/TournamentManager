import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Merge conditional + conflicting Tailwind classes (shadcn convention). */
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

/** Convert a hex color to an `r g b` triple usable in `rgb(... / alpha)`. */
export function hexToRgb(hex) {
  if (!hex) return '99 102 241';
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
}

/** Build inline style vars exposing a team's accent color to a subtree. */
export function accentStyle(hex) {
  return { '--team-accent': hex || '#6366f1', '--team-accent-rgb': hexToRgb(hex) };
}

/**
 * Accept only same-origin uploaded assets for tournament/banner images.
 * This avoids arbitrary protocols or cross-origin URLs being injected into CSS.
 */
export function normalizeUploadAssetUrl(value) {
  if (typeof value !== 'string') return '';
  const raw = value.trim();
  if (!raw) return '';
  if (raw.startsWith('/uploads/')) return raw;
  if (typeof window === 'undefined') return '';
  try {
    const parsed = new URL(raw, window.location.origin);
    if (!['http:', 'https:'].includes(parsed.protocol)) return '';
    if (parsed.origin !== window.location.origin) return '';
    if (!parsed.pathname.startsWith('/uploads/')) return '';
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return '';
  }
}

export function cssBackgroundImageUrl(value) {
  const safe = normalizeUploadAssetUrl(value);
  if (!safe) return undefined;
  return `url("${encodeURI(safe).replace(/"/g, '%22')}")`;
}

export function initials(name = '') {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

/**
 * Platform-aware label for the command-palette shortcut. macOS users expect the
 * Cmd glyph; everyone else (Windows/Linux) expects "Ctrl". The palette itself
 * listens for both, so this only affects the on-screen hint.
 */
export function shortcutModifier() {
  if (typeof navigator === 'undefined') return 'Ctrl';
  const platform = navigator.userAgentData?.platform || navigator.platform || '';
  return /mac|iphone|ipad|ipod/i.test(platform) ? '⌘' : 'Ctrl';
}
