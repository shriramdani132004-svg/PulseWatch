import { execFileSync } from 'child_process';
import { existsSync } from 'fs';
import { resolve } from 'path';
import './env';
import { assertDatabaseNameIsTest } from '../../src/config/env.validation';

export default function globalSetup(): void {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('TEST_DATABASE_URL is required for integration and end-to-end tests');
  }
  assertDatabaseNameIsTest(databaseUrl);

  const root = resolve(__dirname, '../../../..');
  if (!existsSync(resolve(root, 'prisma/schema.prisma'))) {
    throw new Error('Could not locate prisma/schema.prisma for test migration setup');
  }

  const executable = process.platform === 'win32' ? 'corepack.cmd' : 'corepack';
  execFileSync(executable, ['pnpm', 'exec', 'prisma', 'migrate', 'deploy', '--schema', 'prisma/schema.prisma'], {
    cwd: root,
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
      DIRECT_URL: process.env.DIRECT_URL ?? databaseUrl,
    },
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
}
