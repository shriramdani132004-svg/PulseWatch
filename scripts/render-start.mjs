#!/usr/bin/env node
/**
 * Production entrypoint for the PulseWatch API on Render.
 *
 * Responsibilities:
 *   1. Fail fast with actionable (secret-free) messages when required
 *      environment variables are missing or malformed.
 *   2. Apply committed Prisma migrations with `prisma migrate deploy`.
 *   3. Start the compiled NestJS API and forward termination signals.
 *
 * Secrets are never printed. Only variable names and shape-level problems are
 * reported so that Render logs stay safe to share.
 */
import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const apiEntry = path.join(root, 'apps', 'api', 'dist', 'main.js');
const schemaPath = path.join(root, 'prisma', 'schema.prisma');

const REQUIRED = [
  'DATABASE_URL',
  'DIRECT_URL',
  'REDIS_URL',
  'JWT_SECRET',
  'JWT_REFRESH_SECRET',
  'MONITOR_ENCRYPTION_KEY',
  'FRONTEND_ORIGIN',
];

const problems = [];

function present(name) {
  const value = process.env[name];
  return typeof value === 'string' && value.trim().length > 0;
}

function checkUrl(name, protocols) {
  if (!present(name)) return;
  try {
    const parsed = new URL(process.env[name]);
    if (!protocols.includes(parsed.protocol)) {
      problems.push(`${name} must use one of: ${protocols.join(', ')}`);
    }
  } catch {
    problems.push(`${name} is not a valid URL`);
  }
}

for (const name of REQUIRED) {
  if (!present(name)) problems.push(`${name} is required`);
}

if (present('NODE_ENV') && process.env.NODE_ENV !== 'production') {
  problems.push('NODE_ENV must be "production" for the Render API service');
}

checkUrl('DATABASE_URL', ['postgresql:', 'postgres:']);
checkUrl('DIRECT_URL', ['postgresql:', 'postgres:']);
checkUrl('REDIS_URL', ['redis:', 'rediss:']);

for (const name of ['JWT_SECRET', 'JWT_REFRESH_SECRET']) {
  if (present(name) && process.env[name].length < 32) {
    problems.push(`${name} must contain at least 32 characters`);
  }
}
if (
  present('JWT_SECRET') &&
  present('JWT_REFRESH_SECRET') &&
  process.env.JWT_SECRET === process.env.JWT_REFRESH_SECRET
) {
  problems.push('JWT_SECRET and JWT_REFRESH_SECRET must be different values');
}

if (present('MONITOR_ENCRYPTION_KEY')) {
  const decoded = Buffer.from(process.env.MONITOR_ENCRYPTION_KEY, 'base64');
  if (decoded.length !== 32) {
    problems.push('MONITOR_ENCRYPTION_KEY must be a base64-encoded 32-byte key');
  }
}

if (present('FRONTEND_ORIGIN')) {
  for (const entry of process.env.FRONTEND_ORIGIN.split(',')) {
    const origin = entry.trim();
    if (!origin) {
      problems.push('FRONTEND_ORIGIN contains an empty entry');
      continue;
    }
    try {
      const parsed = new URL(origin);
      if (parsed.protocol !== 'https:') {
        problems.push('FRONTEND_ORIGIN must use https in production');
      }
    } catch {
      problems.push('FRONTEND_ORIGIN contains an invalid URL');
    }
  }
}

const port = Number(process.env.PORT ?? 4000);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  problems.push('PORT must be a valid TCP port');
}

if (!existsSync(apiEntry)) {
  problems.push('apps/api/dist/main.js is missing; run the build before starting');
}
if (!existsSync(schemaPath)) {
  problems.push('prisma/schema.prisma is missing');
}

if (problems.length > 0) {
  console.error('PulseWatch API cannot start:');
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}

const prismaBinary = path.join(
  root,
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'prisma.cmd' : 'prisma',
);

if (!existsSync(prismaBinary)) {
  console.error('PulseWatch API cannot start: local Prisma CLI is not installed (node_modules/.bin/prisma).');
  process.exit(1);
}

console.log('Applying database migrations with prisma migrate deploy...');
const migrate = spawnSync(prismaBinary, ['migrate', 'deploy', '--schema', schemaPath], {
  cwd: root,
  env: { ...process.env, PRISMA_HIDE_UPDATE_MESSAGE: '1' },
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

if (migrate.error) {
  console.error(`Migration command failed to run: ${migrate.error.message}`);
  process.exit(1);
}
if (migrate.status !== 0) {
  console.error(`Database migrations failed with exit code ${migrate.status ?? 'unknown'}.`);
  process.exit(migrate.status ?? 1);
}

console.log('Starting PulseWatch API...');
const child = spawn(process.execPath, [apiEntry], {
  cwd: root,
  env: process.env,
  stdio: 'inherit',
});

let shuttingDown = false;
function forwardSignal(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`Received ${signal}; shutting down PulseWatch API.`);
  if (!child.killed) child.kill(signal);
}

process.on('SIGTERM', () => forwardSignal('SIGTERM'));
process.on('SIGINT', () => forwardSignal('SIGINT'));

child.on('error', (error) => {
  console.error(`PulseWatch API process error: ${error.message}`);
  process.exit(1);
});

child.on('exit', (code, signal) => {
  if (signal) {
    console.log(`PulseWatch API stopped after signal ${signal}.`);
    process.exit(0);
  }
  process.exit(code ?? 1);
});
