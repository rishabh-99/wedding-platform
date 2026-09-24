import os from 'node:os';
import path from 'node:path';

/**
 * Test database: the `wedding_test` database created by docker/postgres-init.
 * From the host that is localhost:55432; inside the dev container use TEST_DATABASE_URL.
 */
export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgresql://wedding:wedding@localhost:55432/wedding_test?schema=public';

export const TEST_STORAGE_DIR = path.join(os.tmpdir(), `wedding-test-storage-${process.pid}`);

export function applyTestEnv() {
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = TEST_DATABASE_URL;
  process.env.STORAGE_DRIVER = 'local';
  process.env.LOCAL_STORAGE_DIR = TEST_STORAGE_DIR;
  process.env.EMAIL_DRIVER = 'log';
  process.env.PUBLIC_URL = 'http://localhost:3000';
  process.env.LOG_LEVEL = 'silent';
  process.env.FFPROBE_PATH = 'ffprobe-not-installed-in-tests';
}
