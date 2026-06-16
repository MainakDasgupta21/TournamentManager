import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

/**
 * Two-token strategy:
 *  - access token: short-lived, sent in Authorization header, authorises requests
 *  - refresh token: long-lived, stored in an httpOnly cookie, used only to mint
 *    new access tokens at /api/auth/refresh
 */
export function signAccessToken(user) {
  return jwt.sign(
    { sub: user._id.toString(), role: user.role, name: user.name },
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
  return {
    httpOnly: true,
    secure: env.isProd,
    sameSite: env.isProd ? 'none' : 'lax',
    path: '/api/auth',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  };
}
