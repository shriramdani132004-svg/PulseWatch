import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';

export function validateEnvironment(config: Record<string, unknown>): Record<string, unknown> {
  const errors: string[] = [];
  const nodeEnv = String(config.NODE_ENV ?? 'development');
  const isTest = nodeEnv === 'test';
  const result: Record<string, unknown> = { ...config, NODE_ENV: nodeEnv };

  const required = [
    'DATABASE_URL',
    'DIRECT_URL',
    'REDIS_URL',
    'JWT_SECRET',
    'JWT_REFRESH_SECRET',
    'MONITOR_ENCRYPTION_KEY',
    'FRONTEND_ORIGIN',
  ];
  for (const key of required) {
    if (!config[key] || String(config[key]).trim() === '') {
      errors.push(`${key} is required`);
    }
  }

  if (!result.PORT) result.PORT = 4000;
  const port = Number(result.PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    errors.push('PORT must be a valid TCP port');
  }

  for (const key of ['JWT_SECRET', 'JWT_REFRESH_SECRET']) {
    const value = String(config[key] ?? '');
    if (value && value.length < 32) {
      errors.push(`${key} must contain at least 32 characters`);
    }
  }
  if (config.JWT_SECRET && config.JWT_SECRET === config.JWT_REFRESH_SECRET) {
    errors.push('JWT_SECRET and JWT_REFRESH_SECRET must be different');
  }

  const encryptionKey = String(config.MONITOR_ENCRYPTION_KEY ?? '');
  if (encryptionKey) {
    const bytes = Buffer.from(encryptionKey, 'base64');
    if (bytes.length !== 32) {
      errors.push('MONITOR_ENCRYPTION_KEY must be base64-encoded 32 bytes');
    }
  }

  const frontendOrigin = String(config.FRONTEND_ORIGIN ?? '');
  if (frontendOrigin) {
    for (const origin of frontendOrigin.split(',')) {
      try {
        const parsed = new URL(origin.trim());
        if (!['http:', 'https:'].includes(parsed.protocol)) {
          errors.push('FRONTEND_ORIGIN entries must use http or https');
        }
      } catch {
        errors.push('FRONTEND_ORIGIN contains an invalid URL');
      }
    }
  }

  if (!isTest && nodeEnv === 'production') {
    for (const origin of frontendOrigin.split(',')) {
      if (origin.trim().startsWith('http://')) {
        errors.push('FRONTEND_ORIGIN must use https in production');
      }
    }
  }

  if (errors.length > 0) {
    throw new Error(`Environment validation failed:\n- ${errors.join('\n- ')}`);
  }

  return result;
}

export function assertDatabaseNameIsTest(url: string): void {
  let databaseName = '';
  try {
    const parsed = new URL(url);
    databaseName = parsed.pathname.replace(/^\//, '');
  } catch {
    throw new Error('TEST_DATABASE_URL is not a valid PostgreSQL URL');
  }
  if (!databaseName.endsWith('_test')) {
    throw new Error('Refusing to run destructive test setup: database name must end with _test');
  }
}

// Kept for DTO-style environment validation in future extensions.
export function validateConfigObject<T extends object>(cls: new () => T, config: Record<string, unknown>): T {
  const instance = plainToInstance(cls, config);
  const errors = validateSync(instance, { skipMissingProperties: false });
  if (errors.length > 0) {
    throw new Error(errors.map((error) => Object.values(error.constraints ?? {}).join(', ')).join('; '));
  }
  return instance;
}
