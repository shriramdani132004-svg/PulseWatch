import type { ReactNode } from 'react';
import type { IncidentSeverity, IncidentStatus, MonitorStatus } from '@pulsewatch/shared';
import { cn, INCIDENT_STATUS_META, SEVERITY_META, STATUS_META } from '@/lib/format';

export function Badge({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset',
        className,
      )}
    >
      {children}
    </span>
  );
}

export function StatusBadge({ status, showDot = true }: { status: MonitorStatus; showDot?: boolean }) {
  const meta = STATUS_META[status];
  return (
    <Badge className={meta.badge}>
      {showDot ? <span className={cn('h-1.5 w-1.5 rounded-full', meta.dot)} aria-hidden /> : null}
      {meta.label}
    </Badge>
  );
}

export function IncidentStatusBadge({ status }: { status: IncidentStatus }) {
  const meta = INCIDENT_STATUS_META[status];
  return <Badge className={meta.badge}>{meta.label}</Badge>;
}

export function SeverityBadge({ severity }: { severity: IncidentSeverity }) {
  const meta = SEVERITY_META[severity];
  return (
    <Badge className={meta.badge}>
      <span className={cn('h-1.5 w-1.5 rounded-full', meta.dot)} aria-hidden />
      {meta.label}
    </Badge>
  );
}
