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

export function initials(name = '') {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}
