import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

const REFRESH_COOKIE_FALLBACK_MS = 7 * 24 * 60 * 60 * 1000;
const UNIT_TO_MS = {
  ms: 1,
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
  w: 7 * 24 * 60 * 60 * 1000,
};

function parseExpiresToMs(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    // Numeric JWT expiries are in seconds.
    return Math.max(0, value * 1000);
  }
  if (typeof value !== 'string') return null;
  const match = /^(\d+)\s*(ms|s|m|h|d|w)$/i.exec(value.trim());
  if (!match) return null;
  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  return amount * UNIT_TO_MS[unit];
}

/**
 * Two-token strategy:
 *  - access token: short-lived, sent in Authorization header, authorises requests
 *  - refresh token: long-lived, stored in an httpOnly cookie, used only to mint
 *    new access tokens at /api/auth/refresh
 */
export function signAccessToken(user) {
  return jwt.sign(
    // Carry tokenVersion on access tokens too, so logout/revocation can
    // invalidate bearer tokens immediately (not just refresh cookies).
    { sub: user._id.toString(), role: user.role, name: user.name, tv: user.tokenVersion },
    env.jwt.accessSecret,
    { expiresIn: env.jwt.accessExpires }
  );
}

export function signRefreshToken(user, tokenVersion) {
  return jwt.sign(
    { sub: user._id.toString(), tv: tokenVersion },
    env.jwt.refreshSecret,
    { expiresIn: env.jwt.refreshExpires }
  );
}

export function verifyAccessToken(token) {
  return jwt.verify(token, env.jwt.accessSecret, { algorithms: ['HS256'] });
}

export function verifyRefreshToken(token) {
  return jwt.verify(token, env.jwt.refreshSecret, { algorithms: ['HS256'] });
}

/** Refresh-cookie options; httpOnly + sameSite mitigate XSS/CSRF token theft. */
export function refreshCookieOptions() {
  const maxAge =
    parseExpiresToMs(env.jwt.refreshExpires) ?? REFRESH_COOKIE_FALLBACK_MS;
  return {
    httpOnly: true,
    secure: env.isProd,
    sameSite: env.isProd ? 'none' : 'lax',
    path: '/api/auth',
    maxAge,
  };
}
