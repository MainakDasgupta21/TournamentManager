import dotenv from 'dotenv';

dotenv.config();

const nodeEnv = process.env.NODE_ENV ?? 'development';
const isProd = nodeEnv === 'production';
// Only local dev/test may fall back to baked-in placeholder secrets. Any other
// environment (staging, production, preview, ...) MUST provide real secrets so a
// deployment can never silently run on a guessable/forgeable token secret.
const allowDevFallback = nodeEnv === 'development' || nodeEnv === 'test';

/**
 * Centralised, validated environment access. Fail fast on boot if a required
 * secret is missing rather than discovering it mid-request.
 */
function required(key, fallback) {
  const value = process.env[key] ?? fallback;
  if (value === undefined || value === '') {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function boolFromEnv(value, fallback = false) {
  if (value == null || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

// Reject obviously-insecure placeholder secrets outside local dev/test.
const WEAK_SECRET = /^(dev_|change_?me|changeme|secret|password|admin|test)/i;
function requiredSecret(key) {
  const value = required(key, allowDevFallback ? `dev_${key.toLowerCase()}` : undefined);
  if (!allowDevFallback && (WEAK_SECRET.test(value) || value.length < 32)) {
    throw new Error(
      `Insecure value for ${key}: set a strong random secret (e.g. \`openssl rand -hex 48\`) outside development`
    );
  }
  return value;
}

function requiredSeedPassword() {
  const value = required('SEED_ADMIN_PASSWORD', isProd ? undefined : 'admin12345');
  if (isProd && (WEAK_SECRET.test(value) || value.length < 12)) {
    throw new Error(
      'Insecure value for SEED_ADMIN_PASSWORD: use a strong non-default password in production'
    );
  }
  return value;
}

// Allow one or many comma-separated origins.
const clientOrigins = (process.env.CLIENT_ORIGIN ?? 'http://localhost:5173')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

export const env = {
  nodeEnv,
  isProd,
  port: Number(process.env.PORT ?? 5000),

  clientOrigins,

  // Public base URL of the web app, used to build links inside emails (e.g. the
  // password-reset link). Defaults to the first allowed client origin.
  appUrl: (process.env.APP_URL ?? '').replace(/\/$/, '') || clientOrigins[0] || 'http://localhost:5173',

  // Absolute base used to build public upload URLs. Falls back to the request
  // host when unset (fine for single-origin / local dev).
  publicUrl: (process.env.PUBLIC_API_URL ?? '').replace(/\/$/, ''),

  mongoUri: required('MONGODB_URI', 'mongodb://127.0.0.1:27017/tournament_manager'),

  jwt: {
    accessSecret: requiredSecret('JWT_ACCESS_SECRET'),
    refreshSecret: requiredSecret('JWT_REFRESH_SECRET'),
    accessExpires: process.env.JWT_ACCESS_EXPIRES ?? '15m',
    refreshExpires: process.env.JWT_REFRESH_EXPIRES ?? '7d',
  },

  rateLimit: {
    redisUrl: process.env.RATE_LIMIT_REDIS_URL ?? '',
  },

  seed: {
    name: process.env.SEED_ADMIN_NAME ?? 'Super Admin',
    email: process.env.SEED_ADMIN_EMAIL ?? 'admin@tms.local',
    // No built-in default in production: seeding a guessable super-admin
    // password would be a trivial entry point.
    password: requiredSeedPassword(),
    // Production default is false so normal restarts do not reset credentials.
    // Local dev/test default is true for convenience.
    syncPassword: boolFromEnv(process.env.SYNC_SEED_ADMIN_PASSWORD, !isProd),
  },

  // Outbound email. When `host` is empty the email service falls back to logging
  // messages to the server console instead of sending (fine for local dev).
  mail: {
    host: process.env.SMTP_HOST ?? '',
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER ?? '',
    pass: process.env.SMTP_PASS ?? '',
    from: process.env.MAIL_FROM ?? 'TourneyOps <no-reply@tourneyops.local>',
  },
};
