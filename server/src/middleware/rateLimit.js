import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { createClient } from 'redis';
import { env } from '../config/env.js';

let sharedStore;
if (env.rateLimit.redisUrl) {
  try {
    const redis = createClient({ url: env.rateLimit.redisUrl });
    redis.on('error', (err) => {
      console.warn('[rate-limit] redis store unavailable:', err.message);
    });
    redis.connect().catch((err) => {
      console.warn('[rate-limit] redis connection failed:', err.message);
    });
    sharedStore = new RedisStore({
      sendCommand: (...args) => redis.sendCommand(args),
      prefix: 'tms:rate-limit:',
    });
  } catch (err) {
    console.warn('[rate-limit] redis store setup failed:', err.message);
  }
}

const withSharedStore = (options) =>
  sharedStore
    ? { ...options, store: sharedStore, passOnStoreError: true }
    : options;

/** Tight limiter for auth endpoints to slow credential-stuffing / brute force. */
export const authLimiter = rateLimit(withSharedStore({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { message: 'Too many attempts, try again later' } },
}));

/** Looser, app-wide limiter as a basic abuse guard. */
export const apiLimiter = rateLimit(withSharedStore({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { message: 'Too many requests, slow down' } },
}));
