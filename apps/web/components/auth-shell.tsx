import Link from 'next/link';
import type { ReactNode } from 'react';
import { CheckCircle2, ShieldCheck, TimerReset } from 'lucide-react';
import { Logo } from '@/components/logo';

export function AuthShell({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#f6f7fb] lg:grid lg:grid-cols-[1.02fr_0.98fr]">
      <aside className="relative hidden overflow-hidden bg-ink-950 p-10 text-white lg:flex lg:flex-col lg:justify-between xl:p-14">
        <div className="absolute inset-0 landing-grid opacity-60" aria-hidden />
        <div className="absolute -left-24 top-1/3 h-80 w-80 rounded-full bg-brand-600/20 blur-3xl" aria-hidden />
        <div className="relative">
          <Link href="/" aria-label="PulseWatch home">
            <Logo light />
          </Link>
        </div>
        <div className="relative max-w-lg">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent-400">Observation-based monitoring</p>
          <h2 className="mt-4 text-4xl font-semibold leading-tight tracking-tight">
            Your dashboard should never be more confident than your data.
          </h2>
          <p className="mt-5 text-sm leading-7 text-slate-400">
            PulseWatch stores every check, creates incidents only after a real failure threshold, and keeps monitoring
            gaps visible. That is the difference between a status page and evidence.
          </p>
          <div className="mt-8 space-y-3">
            {[
              { icon: ShieldCheck, text: 'SSRF-safe requests with DNS validation and IP pinning' },
              { icon: CheckCircle2, text: 'Incident timelines built from persisted transitions' },
              { icon: TimerReset, text: 'Schedules reconstructed from PostgreSQL after restarts' },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.text} className="flex items-start gap-3 text-sm text-slate-300">
                  <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-white/[0.06] text-accent-300 ring-1 ring-inset ring-white/10">
                    <Icon className="h-3.5 w-3.5" aria-hidden />
                  </span>
                  {item.text}
                </div>
              );
            })}
          </div>
        </div>
        <p className="relative text-xs text-slate-600">
          No fabricated metrics. No inferred uptime. Only recorded observations.
        </p>
      </aside>

      <main className="flex min-h-screen items-center justify-center px-4 py-10 sm:px-6">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center justify-between lg:hidden">
            <Link href="/" aria-label="PulseWatch home">
              <Logo />
            </Link>
            <Link href="/" className="text-xs font-semibold text-slate-500 hover:text-slate-900">
              Back to site
            </Link>
          </div>
          <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-lift sm:p-8">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
            <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
            <div className="mt-7">{children}</div>
          </div>
          <div className="mt-6 text-center text-sm text-slate-500">{footer}</div>
        </div>
      </main>
    </div>
  );
}
