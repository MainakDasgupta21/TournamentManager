import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import { apiLimiter } from './middleware/rateLimit.js';
import { notFound, errorHandler } from './middleware/error.js';
import { UPLOAD_DIR } from './services/imageStorage.js';
import routes from './routes/index.js';

export function createApp() {
  const app = express();

  // Behind a proxy (Render/Heroku/Nginx) so rate-limit + secure cookies work.
  app.set('trust proxy', 1);

  // Allow uploaded images to be embedded from the (separate-origin) client.
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(
    cors({
      origin: env.clientOrigins,
      credentials: true,
    })
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());
  if (!env.isProd) app.use(morgan('dev'));

  app.use('/api', apiLimiter);
  app.use('/api', routes);

  // Serve uploaded assets (logos/banners). Long-cached: filenames are unique.
  app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '7d', immutable: true }));

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
