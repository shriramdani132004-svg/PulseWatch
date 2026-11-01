import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { cn } from '@/lib/format';

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow ? (
          <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.18em] text-brand-600">{eyebrow}</p>
        ) : null}
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-[28px]">{title}</h1>
        {description ? <p className="mt-1.5 max-w-2xl text-sm leading-6 text-slate-500">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = 'neutral',
  trend,
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  icon: LucideIcon;
  tone?: 'neutral' | 'good' | 'warning' | 'danger' | 'brand';
  trend?: 'up' | 'down' | 'flat';
  className?: string;
}) {
  const tones = {
    neutral: 'bg-slate-100 text-slate-600',
    good: 'bg-emerald-50 text-emerald-600',
    warning: 'bg-amber-50 text-amber-600',
    danger: 'bg-rose-50 text-rose-600',
    brand: 'bg-brand-50 text-brand-600',
  };
  const TrendIcon = trend === 'up' ? ArrowUpRight : trend === 'down' ? ArrowDownRight : Minus;
  return (
    <div className={cn('rounded-2xl border border-slate-200/80 bg-white p-5 shadow-soft', className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</p>
          <p className="mt-2 truncate text-[26px] font-semibold tracking-tight text-slate-900">{value}</p>
          {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
        </div>
        <span className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-xl', tones[tone])}>
          <Icon className="h-5 w-5" aria-hidden />
        </span>
      </div>
      {trend ? (
        <div className="mt-3 flex items-center gap-1 text-[11px] font-medium text-slate-400">
          <TrendIcon className="h-3.5 w-3.5" aria-hidden />
          Observation trend
        </div>
      ) : null}
    </div>
  );
}

export function MonitoringNotice({ text, className }: { text?: string; className?: string }) {
  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-2xl border border-sky-200/70 bg-sky-50/70 px-4 py-3 text-sm text-sky-900',
        className,
      )}
      role="note"
    >
      <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-sky-100 text-[11px] font-bold text-sky-700">
        i
      </span>
      <p className="leading-5">
        {text ??
          'PulseWatch reports only observed checks. Free hosting may sleep after inactivity; gaps are shown as missing observations, never as uptime.'}
      </p>
    </div>
  );
}
