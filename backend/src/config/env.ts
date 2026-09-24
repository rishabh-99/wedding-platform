import path from 'node:path';
import { z } from 'zod';

/**
 * Environment configuration. Every value has a development default so
 * `docker compose up` works with no .env file. Production refuses to boot
 * with insecure defaults.
 */

const DEV_JWT_SECRET = 'dev-only-insecure-jwt-secret-change-me-in-production-0123456789';

const bool = z
  .union([z.boolean(), z.string()])
  .transform((v) => (typeof v === 'boolean' ? v : ['1', 'true', 'yes', 'on'].includes(v.toLowerCase())));

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().default(4000),
  HOST: z.string().default('0.0.0.0'),
  PUBLIC_URL: z.string().url().default('http://localhost:3000'),
  DATABASE_URL: z.string().default('postgresql://wedding:wedding@localhost:5432/wedding?schema=public'),

  JWT_SECRET: z.string().min(32).default(DEV_JWT_SECRET),
  SESSION_TTL_HOURS: z.coerce.number().int().min(1).max(24 * 30).default(12),
  COOKIE_SECURE: bool.optional(),
  CORS_ORIGINS: z.string().default(''),
  TRUST_PROXY: z.string().default('loopback, linklocal, uniquelocal'),

  STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
  LOCAL_STORAGE_DIR: z.string().default(path.resolve(process.cwd(), 'storage-data')),
  MEDIA_PUBLIC_PATH: z.string().default('/media'),
  S3_BUCKET: z.string().optional(),
  S3_REGION: z.string().optional(),
  S3_ENDPOINT: z.string().optional(),
  S3_FORCE_PATH_STYLE: bool.default(false),
  S3_PREFIX: z.string().default(''),
  S3_PRESIGN_TTL_SECONDS: z.coerce.number().int().min(60).max(7 * 24 * 3600).default(6 * 3600),
  S3_PUBLIC_BASE_URL: z.string().optional(),

  EMAIL_DRIVER: z.enum(['log', 'smtp']).default('log'),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_SECURE: bool.default(false),
  EMAIL_FROM: z.string().default('Wedding <no-reply@localhost>'),
  ADMIN_NOTIFY_EMAIL: z.string().optional(),

  SEED_ADMIN_EMAIL: z.string().email().default('admin@wedding.local'),
  SEED_ADMIN_PASSWORD: z.string().default('ChangeMe!2026'),
  SEED_ON_EMPTY: bool.default(true),

  // Web Push (optional — generated automatically and stored in the database if not set)
  VAPID_PUBLIC_KEY: z.string().optional(),
  VAPID_PRIVATE_KEY: z.string().optional(),
  VAPID_SUBJECT: z.string().optional(),
  PUSH_ENABLED: bool.default(true),

  FRONTEND_DIST: z.string().optional(),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  ALLOW_TIME_TRAVEL: bool.optional(),
  PG_DUMP_PATH: z.string().default('pg_dump'),
  FFPROBE_PATH: z.string().default('ffprobe'),
});

export type Env = z.infer<typeof schema> & {
  isProd: boolean;
  isTest: boolean;
  cookieSecure: boolean;
  timeTravelEnabled: boolean;
  corsOrigins: string[];
};

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  // Blank lines in .env (e.g. `JWT_SECRET=`) mean "not set", so defaults and production checks apply.
  const cleaned = Object.fromEntries(Object.entries(source).filter(([, v]) => v !== undefined && v.trim() !== ''));
  const parsed = schema.safeParse(cleaned);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  const e = parsed.data;
  const isProd = e.NODE_ENV === 'production';

  if (isProd) {
    const problems: string[] = [];
    if (e.JWT_SECRET === DEV_JWT_SECRET) problems.push('JWT_SECRET must be set to a long random value');
    if (e.STORAGE_DRIVER === 's3' && (!e.S3_BUCKET || !e.S3_REGION)) {
      problems.push('S3_BUCKET and S3_REGION are required when STORAGE_DRIVER=s3');
    }
    if (e.EMAIL_DRIVER === 'smtp' && !e.SMTP_HOST) problems.push('SMTP_HOST is required when EMAIL_DRIVER=smtp');
    if (problems.length) throw new Error(`Refusing to start in production:\n  - ${problems.join('\n  - ')}`);
  }

  const corsOrigins = e.CORS_ORIGINS.split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (!corsOrigins.length) corsOrigins.push(new URL(e.PUBLIC_URL).origin);

  return {
    ...e,
    isProd,
    isTest: e.NODE_ENV === 'test',
    cookieSecure: e.COOKIE_SECURE ?? isProd,
    timeTravelEnabled: e.ALLOW_TIME_TRAVEL ?? !isProd,
    corsOrigins,
  };
}

export const env: Env = loadEnv();
export const DEV_DEFAULT_ADMIN_PASSWORD = 'ChangeMe!2026';
