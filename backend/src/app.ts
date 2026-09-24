import path from 'node:path';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { env } from './config/env';
import { serveSpaShell } from './html';
import { asyncHandler } from './lib/errors';
import { logger } from './lib/logger';
import { prisma } from './lib/prisma';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { apiLimiter } from './middleware/rateLimit';
import { broker } from './realtime/sseBroker';
import { adminRouter } from './routes/admin.routes';
import { publicRouter } from './routes/public.routes';
import { settingsService } from './services/settings.service';
import { LocalStorageProvider, storage } from './storage';
import type { Variants } from './services/mappers';

export function createApp(): Express {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', env.TRUST_PROXY);

  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          'default-src': ["'self'"],
          'img-src': ["'self'", 'data:', 'blob:', 'https:'],
          'media-src': ["'self'", 'blob:', 'https:'],
          'connect-src': ["'self'"],
          'font-src': ["'self'", 'data:'],
          'style-src': ["'self'", "'unsafe-inline'"],
          'script-src': ["'self'"],
          'frame-ancestors': ["'none'"],
          'form-action': ["'self'"],
          'upgrade-insecure-requests': env.isProd ? [] : null,
        },
      },
      crossOriginEmbedderPolicy: false,
      frameguard: { action: 'deny' },
      crossOriginResourcePolicy: { policy: 'same-site' },
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
      strictTransportSecurity: env.isProd ? { maxAge: 31536000, includeSubDomains: true } : false,
    }),
  );

  app.use(
    cors({
      origin: (origin, cb) => cb(null, !origin || env.corsOrigins.includes(origin)),
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
      allowedHeaders: ['Content-Type', 'X-CSRF-Token', 'Last-Event-ID'],
      maxAge: 600,
    }),
  );

  // Compress everything except the SSE stream (compression buffers and would delay events).
  app.use(
    compression({
      filter: (req, res) => {
        if (req.path === '/api/live/stream') return false;
        return compression.filter(req, res);
      },
    }),
  );

  if (!env.isTest) {
    app.use(
      pinoHttp({
        logger,
        autoLogging: { ignore: (req) => req.url === '/api/health' || req.url?.startsWith('/api/live/stream') === true },
        customLogLevel: (_req, res, err) => (err || res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info'),
      }),
    );
  }

  app.use(cookieParser());
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: false, limit: '256kb' }));

  app.get('/api/health', asyncHandler(async (_req, res) => {
    await prisma.$queryRaw`SELECT 1`;
    res.setHeader('Cache-Control', 'no-store');
    res.json({ status: 'ok', uptime: Math.round(process.uptime()), sseClients: broker.clientCount, storage: storage().driver });
  }));

  // Stable social-preview image URL (presigned S3 URLs expire; crawlers cache).
  app.get('/api/og-image', asyncHandler(async (_req, res) => {
    const s = await settingsService.get();
    const asset = s.ogImageAssetId ? await prisma.mediaAsset.findUnique({ where: { id: s.ogImageAssetId } }) : null;
    if (!asset) return res.redirect(302, '/og-image.jpg');
    const variants = (asset.variants ?? {}) as Variants;
    const key = variants.medium?.key ?? asset.storageKey;
    const { stream } = await storage().getStream(key);
    res.setHeader('Content-Type', variants.medium?.mime ?? asset.mimeType);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    stream.pipe(res);
  }));

  app.use('/api', (req, res, next) => (req.path === '/live/stream' ? next() : apiLimiter(req, res, next)));
  app.use('/api/admin', adminRouter);
  app.use('/api', publicRouter);
  app.use('/api', notFoundHandler);

  // Local media (development / single-server deployments). Only the public "wedding/" tree is exposed;
  // "private/" (database backups) is never served.
  const provider = storage();
  if (provider instanceof LocalStorageProvider) {
    app.use(
      `${env.MEDIA_PUBLIC_PATH}/wedding`,
      express.static(path.join(provider.rootDir, 'wedding'), {
        immutable: true,
        maxAge: '365d',
        dotfiles: 'deny',
        index: false,
        fallthrough: false,
      }),
    );
  }
  // Anything else under /media (e.g. private/…) is a plain 404 — never the SPA shell.
  app.use(env.MEDIA_PUBLIC_PATH, (_req, res) => {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Not found' } });
  });

  // Production: serve the built frontend (nginx normally serves /assets itself).
  if (env.FRONTEND_DIST) {
    app.use(
      express.static(env.FRONTEND_DIST, {
        index: false,
        setHeaders: (res, filePath) => {
          if (filePath.includes(`${path.sep}assets${path.sep}`)) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        },
      }),
    );
    app.get('*', asyncHandler(serveSpaShell));
  }

  app.use(errorHandler);
  return app;
}
