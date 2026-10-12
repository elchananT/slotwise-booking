import { execSync } from 'node:child_process';
import { join } from 'node:path';

const apiRoot = join(__dirname, '..', '..');

/** Applies pending migrations to the test database once per e2e run. */
export default function globalSetup(): void {
  process.loadEnvFile(join(apiRoot, '.env'));
  const databaseUrl = process.env.DATABASE_URL_TEST;
  if (!databaseUrl?.endsWith('/slotwise_test')) {
    throw new Error(
      'DATABASE_URL_TEST must point at the slotwise_test database',
    );
  }
  execSync('npx prisma migrate deploy --schema prisma/schema.prisma', {
    cwd: apiRoot,
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: 'inherit',
  });
}
