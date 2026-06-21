import http from 'http';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { connectDB, disconnectDB } from './config/db.js';
import { initSocket } from './socket/index.js';
import { ensureSeedSuperAdmin } from './services/superAdminService.js';
import { imageStorageMode, isCloudinaryConfigured } from './services/imageStorage.js';

async function bootstrap() {
  await connectDB();
  await ensureSeedSuperAdmin({ log: true });
  if (env.isProd && !isCloudinaryConfigured()) {
    console.warn(
      '[server] WARNING: Cloudinary is not configured in production; image uploads will use local disk and can be lost on restart/redeploy.'
    );
  }

  const app = createApp();
  const server = http.createServer(app);
  initSocket(server);

  server.listen(env.port, () => {
    console.log(`[server] listening on http://localhost:${env.port} (${env.nodeEnv})`);
    console.log(`[server] socket.io ready; CORS origins: ${env.clientOrigins.join(', ')}`);
    console.log(`[server] image storage: ${imageStorageMode()}`);
  });

  // Graceful shutdown so in-flight requests/connections close cleanly.
  const shutdown = async (signal) => {
    console.log(`\n[server] ${signal} received, shutting down...`);
    server.close(async () => {
      await disconnectDB();
      process.exit(0);
    });
    // Force-exit if close hangs.
    setTimeout(() => process.exit(1), 10000).unref();
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

bootstrap().catch((err) => {
  console.error('[server] failed to start:', err);
  process.exit(1);
});
