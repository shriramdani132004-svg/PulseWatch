# PulseWatch

PulseWatch is a full-stack API monitoring and incident-management platform. It checks HTTP endpoints on a schedule, records only observations it actually made, opens incidents after configurable failure thresholds, and reports observed uptime, latency, coverage, and monitoring gaps.

- **Frontend:** Next.js App Router static export (`apps/web`)
- **API:** NestJS REST API at `/api/v1` with Swagger at `/api/docs` (`apps/api`)
- **Database:** PostgreSQL 17 on Neon, accessed through Prisma (`prisma/schema.prisma`)
- **Queue:** BullMQ on a Redis-compatible Render Key Value instance
- **Shared types:** `packages/shared`
- **Infrastructure:** `render.yaml` (Render Blueprint), `.github/workflows/ci.yml`

> PulseWatch never invents metrics. If the API was asleep, the queue was unavailable, or a monitor was paused, the reports show fewer observed checks and explicit coverage/gap information instead of assuming uptime.

## Features

- Email/password authentication with bcrypt hashing, short-lived JWT access tokens, rotating refresh sessions, HttpOnly cookies, rate limiting, exact-origin validation, Helmet headers, and credential-aware CORS.
- Account-scoped monitors with ownership isolation on every query.
- GET, HEAD, and POST checks with configurable interval, timeout, expected status range, failure/recovery thresholds, and degraded-latency threshold.
- DB-backed scheduler, deterministic BullMQ job IDs, and DB leases so a monitor is not checked twice concurrently.
- Manual **Check now** action.
- Incident lifecycle: open, acknowledge, resolve, automatic recovery, and an append-only incident event timeline.
- Observed-only dashboard and reports with status distribution, latency series, uptime from observed checks, coverage percentage, and stale-monitor detection.
- SSRF defenses: DNS resolution with all-answer validation, private/loopback/link-local/ULA/metadata/multicast/reserved rejection, mixed public/private rejection, IP pinning, TLS SNI preservation, manual redirect validation, timeouts, and bounded response bodies.
- Responsive static frontend with fixed routes and query parameters for resource IDs, so it can be hosted on any static CDN.

## Monorepo layout

```
apps/
  api/            NestJS API, Prisma service, BullMQ worker, tests
  web/            Next.js static frontend, Vitest tests
packages/
  shared/         Shared TypeScript types
prisma/
  schema.prisma   Data model and indexes
  migrations/     Committed SQL migrations
docs/
  ARCHITECTURE.md Design, security model, and operational notes
scripts/
  render-start.mjs Production entrypoint: validate env, migrate, start API
render.yaml       Render Blueprint (Key Value, API, static site)
```

## Local development

### Prerequisites

- Node.js 22 or 24
- pnpm 10.20.0 (Corepack is recommended: `corepack enable`)
- PostgreSQL 17 (local or Neon)
- Redis 7 (local Docker or Render Key Value)

### 1. Install

```bash
corepack pnpm install
```

`postinstall` runs `prisma generate`.

### 2. Configure environment

Copy `.env.example` to `.env` and fill in real values. Never commit `.env`.

Required variables:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Pooled PostgreSQL URL used by the API at runtime |
| `DIRECT_URL` | Direct PostgreSQL URL used by Prisma migrations |
| `REDIS_URL` | Redis/Key Value connection URL |
| `JWT_SECRET` | Access-token signing secret, at least 32 characters |
| `JWT_REFRESH_SECRET` | Refresh-token signing secret, at least 32 characters, different from `JWT_SECRET` |
| `MONITOR_ENCRYPTION_KEY` | Base64-encoded 32-byte AES key for stored custom headers |
| `FRONTEND_ORIGIN` | Exact frontend origin(s), comma-separated |
| `NEXT_PUBLIC_API_BASE_URL` | Build-time API base URL for the frontend |

Generate secrets without printing them:

```bash
openssl rand -base64 48   # JWT secrets
openssl rand -base64 32   # MONITOR_ENCRYPTION_KEY
```

### 3. Prepare the database

```bash
corepack pnpm prisma:deploy
corepack pnpm prisma:status
```

For local schema changes during development, use `corepack pnpm prisma:migrate` and commit the generated migration.

### 4. Run

```bash
corepack pnpm dev
```

- Frontend: <http://localhost:3000>
- API: <http://localhost:4000/api/v1>
- Swagger: <http://localhost:4000/api/docs>

The API loads `.env` from the repository root. The frontend reads `NEXT_PUBLIC_API_BASE_URL` at build time; for local development it falls back to `http://localhost:4000`.

## Tests

```bash
corepack pnpm typecheck       # All workspaces
corepack pnpm test            # API unit tests + frontend tests
corepack pnpm test:api:integration
corepack pnpm test:api:e2e
corepack pnpm build           # Shared, API, and static frontend
```

Integration and end-to-end tests require `TEST_DATABASE_URL` and `TEST_DIRECT_URL`. The database name **must end with `_test`**; the test setup refuses to run destructive truncation otherwise. Tests also use `TEST_REDIS_URL` when provided, otherwise `redis://localhost:6379`.

The end-to-end suite covers registration/login, cookie auth, ownership isolation, origin rejection, failure thresholds, incident creation, acknowledgement, recovery, reports, and check history.

## Production deployment

The included `render.yaml` describes the free-tier topology:

- `pulsewatch-kv`: Render Key Value, free 25 MB, `noeviction` (queue-safe), internal-only
- `pulsewatch-api`: Render free Node web service, built with pnpm, started with `node scripts/render-start.mjs`
- `pulsewatch-web`: Render static site publishing `apps/web/out`
- PostgreSQL: external Neon free project

`scripts/render-start.mjs` validates required environment variables, refuses to start with malformed secrets, runs `prisma migrate deploy`, and then starts the compiled NestJS API. It never prints secret values.

Set these API environment variables in Render:

```
NODE_ENV=production
DATABASE_URL=<Neon pooled URL>
DIRECT_URL=<Neon direct URL>
REDIS_URL=<from the Render Key Value service>
JWT_SECRET=<generated>
JWT_REFRESH_SECRET=<different generated value>
MONITOR_ENCRYPTION_KEY=<base64 32 bytes>
FRONTEND_ORIGIN=https://<static-site-host>
```

Set the static site build variable:

```
NEXT_PUBLIC_API_BASE_URL=https://<api-service-host>
```

The API origin must match `FRONTEND_ORIGIN` exactly (scheme + host, no trailing slash). Because the frontend and API are different origins, production cookies use `SameSite=None; Secure` and the API enables credentialed CORS only for the configured origin.

### Health checks

- `GET /api/v1/health/live` — process liveness
- `GET /api/v1/health/ready` — PostgreSQL tables, applied migrations, Redis, BullMQ, scheduler
- `GET /api/docs` — Swagger UI

## Free-tier limitations

These are real constraints, not simulated outages:

- Render free web services spin down after inactivity and cold-start on the next request. Scheduled checks do not run while the API is asleep. Reports therefore show lower coverage and gaps rather than claiming uptime.
- Render free Key Value has 25 MB and no persistence. Queued jobs may be lost on restart. The scheduler re-queues due monitors from PostgreSQL, so monitoring resumes after startup, but a gap remains visible in the data.
- Neon free PostgreSQL has storage and compute limits and may suspend idle compute. The first request after suspension can be slower.
- Free services do not provide an SLA. Do not use this deployment as the sole monitor for critical production systems.

## Security notes

- Passwords are hashed with bcrypt; refresh tokens are stored only as SHA-256 hashes and rotated on use.
- Cookies are HttpOnly, `Secure` in production, and scoped to `/api/v1` or `/api/v1/auth`.
- Custom request headers are encrypted at rest with AES-256-GCM. Header names are returned, values are never returned.
- Monitor URLs are validated before every request and on redirects. DNS answers are all checked; the validated IP is pinned for the request. Redirects are followed manually with re-validation.
- Response bodies are capped, requests time out, and error messages are sanitized before storage.
- State-changing requests require an `Origin` header that exactly matches `FRONTEND_ORIGIN`.
- API responses are account-scoped; cross-account resource IDs return 404.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the full design.

## License

Private project. All rights reserved.
