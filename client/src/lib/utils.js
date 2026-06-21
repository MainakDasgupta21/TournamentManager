import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

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
 * Accept only uploaded assets from this app (same-origin) or the configured API
 * origin. This blocks arbitrary protocols/origins being injected into CSS while
 * still supporting split frontend/API deployments.
 */
export function normalizeUploadAssetUrl(value) {
  if (typeof value !== 'string') return '';
  const raw = value.trim();
  if (!raw) return '';
  if (raw.startsWith('/uploads/')) {
    if (typeof window === 'undefined') return raw;
    let apiOrigin = window.location.origin;
    try {
      apiOrigin = new URL(API_BASE_URL, window.location.origin).origin;
    } catch {
      apiOrigin = window.location.origin;
    }
    return apiOrigin === window.location.origin ? raw : `${apiOrigin}${raw}`;
  }
  if (typeof window === 'undefined') return '';
  try {
    let apiOrigin = window.location.origin;
    try {
      apiOrigin = new URL(API_BASE_URL, window.location.origin).origin;
    } catch {
      apiOrigin = window.location.origin;
    }
    const parsed = new URL(raw, window.location.origin);
    if (!['http:', 'https:'].includes(parsed.protocol)) return '';
    // Cloudinary CDN assets are served over https from *.cloudinary.com.
    if (parsed.protocol === 'https:' && /(^|\.)cloudinary\.com$/i.test(parsed.hostname)) {
      return parsed.href;
    }
    const trustedOrigins = new Set([window.location.origin, apiOrigin]);
    if (!trustedOrigins.has(parsed.origin)) return '';
    if (!parsed.pathname.startsWith('/uploads/')) return '';
    const path = `${parsed.pathname}${parsed.search}${parsed.hash}`;
    return parsed.origin === window.location.origin ? path : `${parsed.origin}${path}`;
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
