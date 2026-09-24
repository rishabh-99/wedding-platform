import type { Server } from 'node:http';
import { createApp } from './app';
import { DEV_DEFAULT_ADMIN_PASSWORD, env } from './config/env';
import { logger } from './lib/logger';
import { prisma } from './lib/prisma';
import { broker } from './realtime/sseBroker';
import { scheduler } from './realtime/scheduler';
import { storage } from './storage';

async function main() {
  await prisma.$connect();
  const app = createApp();
  broker.start();
  scheduler.start();

  const server: Server = app.listen(env.PORT, env.HOST, () => {
    logger.info(
      { port: env.PORT, env: env.NODE_ENV, storage: storage().driver, email: env.EMAIL_DRIVER },
      `wedding API listening on http://${env.HOST}:${env.PORT}`,
    );
    if (!env.isProd && env.SEED_ADMIN_PASSWORD === DEV_DEFAULT_ADMIN_PASSWORD) {
      logger.warn(
        `DEVELOPMENT admin login: ${env.SEED_ADMIN_EMAIL} / ${DEV_DEFAULT_ADMIN_PASSWORD} — never use these credentials in production`,
      );
    }
  });
  // SSE connections are long-lived; keep sockets alive beyond typical proxy timeouts.
  server.keepAliveTimeout = 65_000;
  server.headersTimeout = 66_000;

  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, 'shutting down gracefully');
    scheduler.stop();
    broker.close();
    const force = setTimeout(() => {
      logger.error('forced shutdown after timeout');
      process.exit(1);
    }, 10_000);
    force.unref();
    server.close(async () => {
      await prisma.$disconnect().catch(() => undefined);
      logger.info('shutdown complete');
      process.exit(0);
    });
    server.closeIdleConnections?.();
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('unhandledRejection', (err) => logger.error({ err }, 'unhandled rejection'));
}

main().catch((err) => {
  logger.fatal({ err }, 'failed to start');
  process.exit(1);
});
