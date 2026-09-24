import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TEST_DATABASE_URL } from './testEnv';

/** Applies all migrations to the test database once before the suite. */
export default function setup() {
  const backendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  execSync('npx prisma migrate deploy --schema prisma/schema.prisma', {
    cwd: backendDir,
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
  });
}
