import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

function loadDotEnv(): void {
  const candidates = [
    resolve(process.cwd(), '.env'),
    resolve(process.cwd(), '../../.env'),
    resolve(__dirname, '../../../../.env'),
  ];
  const file = candidates.find((candidate) => existsSync(candidate));
  if (!file) return;

  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
    if (!match) continue;
    const key = match[1];
    let value = match[2] ?? '';
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

loadDotEnv();

process.env.NODE_ENV = 'test';
process.env.PORT = process.env.PORT ?? '0';
process.env.FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN ?? 'http://localhost:3000';

if (process.env.TEST_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
}
if (process.env.TEST_DIRECT_URL) {
  process.env.DIRECT_URL = process.env.TEST_DIRECT_URL;
}
if (process.env.TEST_REDIS_URL) {
  process.env.REDIS_URL = process.env.TEST_REDIS_URL;
}
process.env.REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';

process.env.JWT_SECRET =
  process.env.JWT_SECRET ?? 'pulsewatch-test-access-secret-at-least-32-characters';
process.env.JWT_REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET ?? 'pulsewatch-test-refresh-secret-at-least-32-characters';
process.env.MONITOR_ENCRYPTION_KEY =
  process.env.MONITOR_ENCRYPTION_KEY ?? Buffer.alloc(32, 7).toString('base64');
