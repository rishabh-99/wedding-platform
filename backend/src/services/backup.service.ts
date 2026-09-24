import { spawn } from 'node:child_process';
import { createGzip } from 'node:zlib';
import type { BackupDTO } from '@wedding/shared';
import { env } from '../config/env';
import { AppError, notFound } from '../lib/errors';
import { logger } from '../lib/logger';
import { prisma } from '../lib/prisma';
import { StorageKeys, storage } from '../storage';

/** pg_dump does not understand Prisma's ?schema= query parameter. */
function pgDumpUrl(url: string): string {
  const u = new URL(url);
  u.searchParams.delete('schema');
  u.searchParams.delete('connection_limit');
  u.searchParams.delete('pool_timeout');
  return u.toString();
}

function runPgDump(): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const child = spawn(env.PG_DUMP_PATH, ['--no-owner', '--no-privileges', '--clean', '--if-exists', pgDumpUrl(env.DATABASE_URL)], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const gzip = createGzip({ level: 9 });
    const chunks: Buffer[] = [];
    let stderr = '';
    let exitCode: number | null = null;
    let gzipDone = false;
    const settle = () => {
      if (exitCode === null || !gzipDone) return;
      if (exitCode !== 0) reject(new Error(`pg_dump exited with ${exitCode}: ${stderr.slice(0, 500)}`));
      else resolve(Buffer.concat(chunks));
    };
    child.stdout.pipe(gzip);
    gzip.on('data', (c: Buffer) => chunks.push(c));
    gzip.on('end', () => {
      gzipDone = true;
      settle();
    });
    child.stderr.on('data', (d: Buffer) => (stderr += d.toString()));
    child.on('error', (err) => reject(err));
    child.on('close', (code) => {
      exitCode = code ?? 1;
      settle();
    });
  });
}

export const backupService = {
  /** Dumps PostgreSQL, gzips it and stores it through the storage provider (private prefix). */
  async create(createdBy?: string): Promise<BackupDTO> {
    let dump: Buffer;
    try {
      dump = await runPgDump();
    } catch (err) {
      logger.error({ err }, 'database backup failed');
      throw new AppError(500, 'BACKUP_FAILED', 'The backup could not be created. Check the server logs.');
    }
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `wedding-db-${stamp}.sql.gz`;
    const key = StorageKeys.backup(filename);
    await storage().put(key, dump, 'application/gzip');
    const row = await prisma.backup.create({ data: { storageKey: key, filename, size: dump.length, createdBy: createdBy ?? null } });
    logger.info({ key, size: dump.length }, 'database backup created');
    return { key: row.storageKey, filename: row.filename, size: row.size, createdAt: row.createdAt.toISOString() };
  },

  async list(): Promise<BackupDTO[]> {
    const rows = await prisma.backup.findMany({ orderBy: { createdAt: 'desc' }, take: 200 });
    return rows.map((r) => ({ key: r.storageKey, filename: r.filename, size: r.size, createdAt: r.createdAt.toISOString() }));
  },

  async open(filename: string) {
    const row = await prisma.backup.findFirst({ where: { filename } });
    if (!row) throw notFound('Backup');
    return { row, ...(await storage().getStream(row.storageKey)) };
  },
};
