# PulseWatch Architecture

## Overview

PulseWatch is a pnpm monorepo with three deployable concerns:

1. **Static frontend** (`apps/web`) — Next.js App Router exported to plain HTML/CSS/JS. It talks to the API directly from the browser with `credentials: 'include'`.
2. **API and worker** (`apps/api`) — NestJS process that serves REST endpoints, runs the DB-backed scheduler, and consumes BullMQ check jobs in the same process.
3. **Data services** — Neon PostgreSQL for durable state and Render Key Value (Redis-compatible) for the job queue.

```
Browser
  │  HTTPS, credentialed fetch
  ▼
Static site (Render CDN)
  │  NEXT_PUBLIC_API_BASE_URL
  ▼
NestJS API (Render free web service)
  ├── PostgreSQL (Neon) ── monitors, sessions, checks, incidents, events
  └── BullMQ queue (Render Key Value)
          │
          └── worker: lease → safe HTTP check → transaction → incident logic
```

There is no server-side proxy or server action. The frontend is fully static; resource IDs are passed as query parameters (`/monitor?id=…`, `/monitors/edit?id=…`, `/incidents/detail?id=…`).

## Authentication and sessions

- Registration and login accept email/password. Passwords are hashed with bcrypt (cost 12).
- Access tokens are short-lived JWTs stored in an HttpOnly cookie scoped to `/api/v1`.
- Refresh tokens are opaque random values. Only their SHA-256 hash is stored in `Session`.
- Refresh rotates the token: the old session row is revoked and a new one is issued.
- Logout revokes the current session and clears both cookies.
- Production cookies use `Secure` and `SameSite=None` because the static site and API are different origins. CORS is credentialed and limited to exact `FRONTEND_ORIGIN` values.
- State-changing requests must include an allowed `Origin` header. The API rejects missing or mismatched origins.
- `@nestjs/throttler` applies a global rate limit; authentication endpoints have stricter limits.

## Data model

| Model | Purpose | Key constraints |
| --- | --- | --- |
| `User` | Account identity | Unique email |
| `Session` | Refresh-token sessions | Unique token hash, cascade delete with user, indexes on `(userId, revokedAt)` and `expiresAt` |
| `Monitor` | Monitored endpoint and scheduling state | Owner FK, status/next-check/lease indexes |
| `CheckResult` | One observed HTTP check | Cascade with monitor, `(monitorId, checkedAt)` and success indexes |
| `Incident` | Incident lifecycle | Cascade with monitor, one open/acknowledged incident per monitor via partial unique index |
| `IncidentEvent` | Append-only timeline | Cascade with incident, `(incidentId, createdAt)` index |

Ownership is enforced in queries by joining or filtering on `userId`. Cross-account IDs return `404` rather than `403` to avoid resource enumeration.

The partial unique index `Incident_one_open_per_monitor` guarantees at most one `OPEN` or `ACKNOWLEDGED` incident per monitor even under concurrent checks.

## Monitoring flow

1. **Scheduler** (every 15 seconds) queries PostgreSQL for monitors where:
   - `pausedAt IS NULL`
   - status is not `PAUSED`
   - `nextCheckAt <= NOW()`
   - ordered by `nextCheckAt`, limited to 25 per scan.
2. For each due monitor, it enqueues a BullMQ job with a deterministic job ID derived from monitor ID and due timestamp. Duplicate enqueues are harmless.
3. **Worker** acquires a DB lease using a conditional `updateMany`:
   - monitor must be unpaused,
   - `nextCheckAt <= NOW()` for scheduled checks,
   - `leaseExpiresAt` must be null or expired.
   The lease token is a UUID valid for 120 seconds.
4. The worker decrypts any custom headers, performs the safe HTTP check, and opens a transaction.
5. Inside the transaction it re-verifies the lease, writes `CheckResult`, updates counters/status, and creates/updates/resolves incidents and timeline events.
6. It clears the lease and sets `nextCheckAt` from the observed check time plus the interval. Manual checks do not move `nextCheckAt` earlier.

If the process dies mid-check, the lease expires and a later scan can retry. No uptime is inferred for the missed interval; the gap remains visible.

## Status and incident rules

- A failed check increments `consecutiveFailures` and resets successes. Below the failure threshold the monitor is `DEGRADED`.
- At or above `failureThreshold`, the monitor becomes `DOWN` and an incident is opened if none is open. Severity escalates to `CRITICAL` at twice the threshold.
- A successful check increments `consecutiveSuccesses` and resets failures.
  - If an incident is open and successes are below `recoveryThreshold`, the incident stays open and a `RECOVERY_DETECTED` event is appended; monitor status is `DEGRADED`.
  - Once the recovery threshold is met, the incident is resolved and the monitor becomes `OPERATIONAL` or `DEGRADED` based on response time.
- Without an open incident, a slow-but-successful check marks the monitor `DEGRADED`.
- Acknowledge and resolve actions are user-initiated and append timeline events. Manual resolve does not fabricate a recovery check.

## SSRF and safe HTTP client

Monitor targets are untrusted. Before each request, and again for each redirect:

1. Parse the URL and allow only `http`/`https`.
2. Reject credentials in the URL, non-standard ports outside the allowed set, and malformed hosts.
3. Resolve DNS and validate **every** answer:
   - reject loopback, private, link-local, unique-local, multicast, reserved, unspecified, and cloud metadata ranges;
   - reject IPv4-mapped IPv6 forms that resolve to blocked IPv4 space;
   - reject a DNS answer set that mixes public and blocked addresses.
4. Pin the validated IP for the actual socket connection.
5. Preserve the original hostname for TLS SNI and certificate verification.
6. Follow redirects manually, re-validating each hop, with a bounded redirect count.
7. Enforce per-monitor timeouts and a maximum response body size. Only status, timing, and sanitized error metadata are stored.

Custom headers are encrypted with AES-256-GCM using `MONITOR_ENCRYPTION_KEY`. Header values are never returned by the API; only names are shown in the UI.

## Reports and honesty guarantees

Reports aggregate only rows in `CheckResult`. There is no synthetic backfill.

- `observedUptimePercent` = successful observed checks / total observed checks.
- `averageResponseTimeMs` = average of observed response times.
- `monitoringCoveragePercent` compares observed checks with the number expected from each monitor's interval and creation time, capped at 100.
- `staleMonitors` counts active monitors whose last observation is older than `max(3 × interval, 2 minutes)`.
- Series buckets contain only buckets with observations; missing buckets are gaps, not zero-uptime or zero-latency points.

The API includes a monitoring notice explaining that free hosting can sleep and that gaps are missing observations, not uptime.

## Deployment

`render.yaml` defines:

- Render Key Value `pulsewatch-kv` (free, `noeviction`, internal-only).
- Render web service `pulsewatch-api` (free, Node 22, `node scripts/render-start.mjs`).
- Render static site `pulsewatch-web` (publishes `apps/web/out`).

Neon provides PostgreSQL. `DATABASE_URL` uses the pooled endpoint; `DIRECT_URL` uses the direct endpoint for migrations. `scripts/render-start.mjs`:

1. validates required variables and secret shapes without printing values;
2. runs `prisma migrate deploy`;
3. starts `apps/api/dist/main.js`;
4. forwards `SIGTERM`/`SIGINT` for graceful shutdown.

Health endpoints:

- `/api/v1/health/live` — liveness.
- `/api/v1/health/ready` — database tables, applied migrations, Redis, queue, scheduler.

## Failure modes and limitations

| Failure | Behavior |
| --- | --- |
| API asleep (Render free) | No checks run; reports show gaps and reduced coverage |
| Redis unavailable | Readiness fails; scheduler logs queue errors; checks do not run |
| Process dies mid-check | Lease expires after 120s; later scan retries; gap remains visible |
| Neon suspended | First request may be slow; readiness may fail until compute resumes |
| Key Value restart (free, no persistence) | Queued jobs lost; scheduler re-enqueues due monitors from PostgreSQL |
| Duplicate jobs | Deterministic job IDs and DB leases prevent concurrent checks |
| Concurrent incident creation | Partial unique index allows only one open incident per monitor |

## Testing strategy

- **Unit tests:** URL/IP validation, header validation, safe HTTP behavior, encryption.
- **Integration test:** Prisma connectivity and migration state against a `_test` database.
- **End-to-end test:** full HTTP lifecycle with a stubbed safe HTTP client, covering auth, ownership isolation, origin rejection, thresholds, incidents, recovery, reports, and check history.
- **Frontend tests:** component and client behavior with Vitest and Testing Library.
- **CI:** GitHub Actions runs typecheck, all test suites, and a production build against PostgreSQL and Redis services.
