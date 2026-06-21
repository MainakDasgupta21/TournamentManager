import mongoose from 'mongoose';
import { env } from './env.js';

/**
 * Connect to MongoDB. We keep strictQuery on (Mongoose 8 default) and surface
 * connection lifecycle events so operational issues are visible in logs.
 */
export async function connectDB() {
  mongoose.set('strictQuery', true);

  // Guardrail: a non-production environment pointed at a remote cluster is a
  // common way to accidentally run tests/dev writes against production data.
  if (!env.isProd && !/(?:@|\/\/)(localhost|127\.0\.0\.1|\[::1\])/.test(env.mongoUri)) {
    console.warn(
      `[db] WARNING: NODE_ENV=${env.nodeEnv} is connecting to a non-local database. ` +
        'Point local dev/test at a local or throwaway DB to avoid touching production data.'
    );
  }

  mongoose.connection.on('connected', () => {
    console.log(`[db] connected: ${mongoose.connection.host}/${mongoose.connection.name}`);
  });
  mongoose.connection.on('error', (err) => {
    console.error('[db] connection error:', err.message);
  });
  mongoose.connection.on('disconnected', () => {
    console.warn('[db] disconnected');
  });

  await mongoose.connect(env.mongoUri, {
    serverSelectionTimeoutMS: 10000,
  });

  return mongoose.connection;
}

export async function disconnectDB() {
  await mongoose.connection.close();
}
