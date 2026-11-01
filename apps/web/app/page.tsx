import Link from 'next/link';
import {
  Activity,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Clock3,
  Database,
  Eye,
  Fingerprint,
  GitBranch,
  Globe2,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
  Siren,
  Sparkles,
  TimerReset,
  TriangleAlert,
  Zap,
} from 'lucide-react';
import { PublicHeader } from '@/components/public-header';
import { Logo } from '@/components/logo';

const features = [
  {
    icon: Globe2,
    title: 'Endpoint monitoring',
    description:
      'Register HTTP endpoints, choose intervals and timeouts, define expected status ranges, and run checks on a schedule.',
  },
  {
    icon: ShieldCheck,
    title: 'SSRF-safe request layer',
    description:
      'DNS is resolved and validated before every connection. Private, loopback, link-local, multicast, and metadata addresses are rejected.',
  },
  {
    icon: Siren,
    title: 'Incidents that follow evidence',
    description:
      'Consecutive failures cross a threshold before an incident opens. Recovery resolves it, and every transition is written to a timeline.',
  },
  {
    icon: BarChart3,
    title: 'Observed analytics',
    description:
      'Uptime is calculated from recorded checks only. Response-time trends, status distributions, and coverage gaps stay visible.',
  },
  {
    icon: Database,
    title: 'PostgreSQL is the source of truth',
    description:
      'Schedules, leases, check results, incidents, and sessions live in PostgreSQL. Redis dispatches work but never owns business history.',
  },
  {
    icon: Fingerprint,
    title: 'Security by default',
    description:
      'Short-lived access JWTs, rotating refresh sessions, HttpOnly cookies, password hashing, origin validation, and encrypted monitor headers.',
  },
];

const workflow = [
  {
    step: '01',
    title: 'Register an endpoint',
    description: 'Define the URL, method, interval, timeout, expected status range, and failure threshold.',
    icon: Activity,
  },
  {
    step: '02',
    title: 'Validate the destination',
    description: 'The safe client resolves A/AAAA records, rejects non-public addresses, and pins the validated IP.',
    icon: ShieldCheck,
  },
  {
    step: '03',
    title: 'Persist the observation',
    description: 'Each real check records success, HTTP status, latency, error classification, and timestamp.',
    icon: Database,
  },
  {
    step: '04',
    title: 'Escalate and recover',
    description: 'Failures create one incident at the threshold. Recovery closes it with a complete event history.',
    icon: RefreshCw,
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-ink-950 text-white">
      <PublicHeader />

      <main>
        <section className="relative overflow-hidden pb-20 pt-32 sm:pb-28 sm:pt-40">
          <div className="absolute inset-0 landing-grid opacity-70" aria-hidden />
          <div className="absolute -left-40 top-10 h-96 w-96 rounded-full bg-brand-600/20 blur-3xl" aria-hidden />
          <div className="absolute -right-32 top-40 h-96 w-96 rounded-full bg-accent-500/10 blur-3xl" aria-hidden />
          <div className="relative mx-auto grid max-w-7xl items-center gap-14 px-4 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:px-8">
            <div className="animate-fade-up">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-slate-300 backdrop-blur">
                <Sparkles className="h-3.5 w-3.5 text-accent-400" aria-hidden />
                Observation-based API monitoring
              </div>
              <h1 className="mt-6 max-w-2xl text-4xl font-semibold leading-[1.08] tracking-[-0.04em] sm:text-6xl">
                Know when your APIs fail.
                <span className="block bg-gradient-to-r from-brand-300 via-white to-accent-300 bg-clip-text text-transparent">
                  Prove what happened later.
                </span>
              </h1>
              <p className="mt-6 max-w-xl text-base leading-7 text-slate-400 sm:text-lg">
                PulseWatch checks your endpoints, records real observations, detects sustained failures, and builds an
                incident timeline you can actually defend. No fabricated uptime. No hidden gaps.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/register"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-500 to-accent-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-brand-950/30 transition hover:brightness-110"
                >
                  Start monitoring
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
                <Link
                  href="/login"
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.03] px-5 py-3 text-sm font-semibold text-slate-200 transition hover:bg-white/[0.07]"
                >
                  Sign in to your workspace
                </Link>
              </div>
              <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-500">
                <span className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" aria-hidden />
                  SSRF-safe checks
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" aria-hidden />
                  PostgreSQL-backed history
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" aria-hidden />
                  Rotating sessions
                </span>
              </div>
            </div>

            <div className="relative animate-fade-up [animation-delay:120ms]">
              <div className="absolute -inset-6 rounded-[2.5rem] bg-gradient-to-br from-brand-500/20 to-accent-500/10 blur-2xl" aria-hidden />
              <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-ink-900/90 shadow-2xl backdrop-blur">
                <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-rose-400/70" />
                    <span className="h-2.5 w-2.5 rounded-full bg-amber-400/70" />
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/70" />
                  </div>
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                    Interface preview
                  </span>
                </div>
                <div className="grid gap-4 p-5 sm:grid-cols-[0.8fr_1.2fr]">
                  <div className="space-y-3">
                    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Monitor state</span>
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400/10 px-2 py-1 text-[10px] font-semibold text-emerald-300">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                          Operational
                        </span>
                      </div>
                      <div className="mt-4 h-2 w-24 rounded-full bg-white/10" />
                      <div className="mt-2 h-2 w-16 rounded-full bg-white/5" />
                      <div className="mt-5 grid grid-cols-2 gap-2">
                        <div className="rounded-xl bg-white/[0.03] p-2.5">
                          <div className="h-1.5 w-8 rounded bg-white/10" />
                          <div className="mt-2 h-3 w-12 rounded bg-white/20" />
                        </div>
                        <div className="rounded-xl bg-white/[0.03] p-2.5">
                          <div className="h-1.5 w-8 rounded bg-white/10" />
                          <div className="mt-2 h-3 w-12 rounded bg-white/20" />
                        </div>
                      </div>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Incident lifecycle</div>
                      <div className="mt-3 space-y-2.5">
                        {['Failure observed', 'Threshold reached', 'Incident opened', 'Recovery verified'].map((label, index) => (
                          <div key={label} className="flex items-center gap-2 text-[11px] text-slate-400">
                            <span className={`h-2 w-2 rounded-full ${index === 3 ? 'bg-emerald-400' : index === 2 ? 'bg-rose-400' : 'bg-amber-400'}`} />
                            {label}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Observation timeline</div>
                        <div className="mt-1 text-xs text-slate-300">Only recorded checks count</div>
                      </div>
                      <Eye className="h-4 w-4 text-slate-500" aria-hidden />
                    </div>
                    <div className="mt-6 flex h-36 items-end gap-1.5">
                      {[28, 40, 34, 52, 46, 62, 44, 56, 70, 50, 66, 74, 58, 80, 68, 86, 62, 76, 88, 72].map((height, index) => (
                        <div key={index} className="flex-1 rounded-t-sm bg-gradient-to-t from-brand-500/30 to-accent-400/80" style={{ height: `${height}%` }} />
                      ))}
                    </div>
                    <div className="mt-4 flex items-center justify-between text-[10px] text-slate-500">
                      <span>Earlier</span>
                      <span>Now</span>
                    </div>
                    <div className="mt-4 flex items-center gap-2 rounded-xl border border-sky-400/10 bg-sky-400/5 px-3 py-2 text-[11px] text-sky-200">
                      <TriangleAlert className="h-3.5 w-3.5 shrink-0" aria-hidden />
                      Missing periods are shown as gaps, not uptime.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="border-t border-white/5 bg-ink-950 py-20 sm:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="max-w-2xl">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent-400">Built for evidence</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
                Monitoring that refuses to invent good news
              </h2>
              <p className="mt-4 text-base leading-7 text-slate-400">
                Every number on the dashboard traces back to a stored check. Every incident traces back to a real
                failure threshold. Every recovery is verified by an observation.
              </p>
            </div>
            <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {features.map((feature) => {
                const Icon = feature.icon;
                return (
                  <div
                    key={feature.title}
                    className="group rounded-2xl border border-white/10 bg-white/[0.025] p-6 transition hover:border-white/20 hover:bg-white/[0.045]"
                  >
                    <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-brand-500/20 to-accent-500/10 text-accent-300 ring-1 ring-inset ring-white/10">
                      <Icon className="h-5 w-5" aria-hidden />
                    </span>
                    <h3 className="mt-5 text-sm font-semibold text-white">{feature.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-400">{feature.description}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section id="workflow" className="bg-[#f6f7fb] py-20 text-slate-900 sm:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-600">How it works</p>
                <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">From endpoint to incident timeline</h2>
                <p className="mt-4 text-base leading-7 text-slate-600">
                  The scheduler reads due monitors from PostgreSQL, dispatches jobs through BullMQ, and a database lease
                  prevents duplicate checks. Redis can be rebuilt. History cannot be faked.
                </p>
                <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-soft">
                  <div className="flex items-center gap-3">
                    <span className="grid h-9 w-9 place-items-center rounded-xl bg-slate-900 text-white">
                      <GitBranch className="h-4 w-4" aria-hidden />
                    </span>
                    <div>
                      <p className="text-sm font-semibold">PostgreSQL remains authoritative</p>
                      <p className="text-xs text-slate-500">Schedules, leases, checks, incidents, and sessions</p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {workflow.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.step} className="relative rounded-2xl border border-slate-200 bg-white p-6 shadow-soft">
                      <span className="absolute right-5 top-5 text-[11px] font-bold tracking-[0.14em] text-slate-300">{item.step}</span>
                      <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-50 text-brand-600">
                        <Icon className="h-5 w-5" aria-hidden />
                      </span>
                      <h3 className="mt-5 text-sm font-semibold text-slate-900">{item.title}</h3>
                      <p className="mt-2 text-sm leading-6 text-slate-500">{item.description}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        <section id="security" className="border-y border-white/5 bg-ink-900 py-20 sm:py-24">
          <div className="mx-auto grid max-w-7xl gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:px-8">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent-400">Security architecture</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
                Monitoring arbitrary URLs is a security problem first
              </h2>
              <p className="mt-4 text-base leading-7 text-slate-400">
                PulseWatch treats every monitor target as hostile input. The request layer validates DNS answers,
                rejects private and reserved ranges, pins the validated IP, preserves TLS hostname verification, and
                validates every redirect independently.
              </p>
              <div className="mt-8 grid gap-3 sm:grid-cols-2">
                {[
                  'Blocks loopback, private, link-local, ULA, multicast, and metadata ranges',
                  'Rejects mixed public/private DNS answers',
                  'Disables automatic redirects and limits manual redirects',
                  'Encrypts custom headers with AES-256-GCM',
                  'Never returns stored header values',
                  'Origin validation on state-changing requests',
                ].map((item) => (
                  <div key={item} className="flex items-start gap-2.5 text-sm text-slate-300">
                    <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-accent-400" aria-hidden />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 sm:p-8">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Request guardrails</p>
                  <p className="mt-1 text-sm font-semibold text-white">Validation before connection</p>
                </div>
                <ShieldCheck className="h-6 w-6 text-accent-400" aria-hidden />
              </div>
              <div className="mt-6 space-y-3">
                {[
                  { label: 'Parse and normalize URL', state: 'passed' },
                  { label: 'Reject embedded credentials', state: 'passed' },
                  { label: 'Resolve A and AAAA records', state: 'passed' },
                  { label: 'Validate every address', state: 'passed' },
                  { label: 'Pin validated destination IP', state: 'passed' },
                  { label: 'Verify TLS certificate', state: 'passed' },
                  { label: 'Validate each redirect target', state: 'passed' },
                ].map((row) => (
                  <div key={row.label} className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.025] px-3.5 py-2.5">
                    <span className="text-xs text-slate-300">{row.label}</span>
                    <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-emerald-300">
                      <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                      enforced
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="limits" className="bg-[#f6f7fb] py-20 text-slate-900 sm:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid gap-10 lg:grid-cols-[1fr_1.15fr] lg:items-center">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-600">Honest by design</p>
                <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
                  Free-tier hosting has real limits. The product says so.
                </h2>
                <p className="mt-4 text-base leading-7 text-slate-600">
                  The API can sleep after inactivity. Redis may lose dispatch state. PulseWatch reconstructs due work
                  from PostgreSQL when it wakes, restores the next check time, and shows monitoring gaps. It never
                  backfills fabricated checks or claims verified uptime for periods it did not observe.
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {[
                  { icon: Clock3, title: 'Observed uptime only', text: 'Successful recorded checks divided by all recorded checks. No data means no percentage.' },
                  { icon: TimerReset, title: 'Overdue work recovers', text: 'The scheduler finds monitors whose nextCheckAt is in the past and queues a fresh check.' },
                  { icon: TriangleAlert, title: 'Gaps stay visible', text: 'Coverage below the expected cadence is surfaced as a gap indicator, not a perfect score.' },
                  { icon: Zap, title: 'Free infrastructure', text: 'Neon PostgreSQL, Render Web Service, Static Site, and Key Value on free plans.' },
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft">
                      <span className="grid h-9 w-9 place-items-center rounded-xl bg-slate-900 text-white">
                        <Icon className="h-4 w-4" aria-hidden />
                      </span>
                      <h3 className="mt-4 text-sm font-semibold text-slate-900">{item.title}</h3>
                      <p className="mt-2 text-sm leading-6 text-slate-500">{item.text}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        <section className="relative overflow-hidden bg-ink-950 py-20">
          <div className="absolute inset-0 landing-grid opacity-40" aria-hidden />
          <div className="relative mx-auto max-w-3xl px-4 text-center sm:px-6">
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Start with one endpoint. Keep the evidence.</h2>
            <p className="mt-4 text-base text-slate-400">
              Create a monitor, run a real check, and watch the observation become history. No credit card required.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Link
                href="/register"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
              >
                Create your account
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 px-5 py-3 text-sm font-semibold text-slate-200 transition hover:bg-white/5"
              >
                Sign in
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/10 bg-ink-950 py-8">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 sm:flex-row sm:px-6 lg:px-8">
          <Logo light />
          <p className="text-xs text-slate-500">Observation-based API monitoring and incident management.</p>
          <p className="text-xs text-slate-600">Built with NestJS, Next.js, PostgreSQL, Prisma, Redis, and BullMQ.</p>
        </div>
      </footer>
    </div>
  );
}
