'use client';

import Link from 'next/link';
import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import type { IncidentDetail, IncidentEventType } from '@pulsewatch/shared';
import {
  ArrowLeft,
  BellRing,
  CheckCircle2,
  Clock3,
  ExternalLink,
  FileText,
  RefreshCw,
  SearchX,
  ShieldCheck,
  Siren,
  TriangleAlert,
} from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { useApiQuery } from '@/lib/hooks';
import { useToast } from '@/components/toast';
import { formatDateTime, formatDuration, formatRelative } from '@/lib/format';
import { PageHeader, MonitoringNotice } from '@/components/ui/page';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { IncidentStatusBadge, SeverityBadge } from '@/components/ui/badge';
import { Button, buttonClasses } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/modal';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { PageSkeleton } from '@/components/loading';

const EVENT_META: Record<IncidentEventType, { label: string; icon: typeof BellRing; className: string }> = {
  CREATED: { label: 'Incident opened', icon: Siren, className: 'bg-rose-50 text-rose-600' },
  ACKNOWLEDGED: { label: 'Acknowledged', icon: BellRing, className: 'bg-amber-50 text-amber-600' },
  RESOLVED: { label: 'Resolved', icon: CheckCircle2, className: 'bg-emerald-50 text-emerald-600' },
  CHECK_FAILED: { label: 'Check failed', icon: TriangleAlert, className: 'bg-rose-50 text-rose-600' },
  RECOVERY_DETECTED: { label: 'Recovery observed', icon: RefreshCw, className: 'bg-sky-50 text-sky-600' },
  STATUS_CHANGED: { label: 'Status changed', icon: Clock3, className: 'bg-slate-100 text-slate-600' },
  NOTE: { label: 'Note', icon: FileText, className: 'bg-slate-100 text-slate-600' },
};

function IncidentDetailContent() {
  const searchParams = useSearchParams();
  const id = searchParams.get('id');
  const toast = useToast();
  const [action, setAction] = useState<'acknowledge' | 'resolve' | null>(null);
  const [confirmResolve, setConfirmResolve] = useState(false);

  const { data, error, loading, refetch } = useApiQuery<IncidentDetail>(
    id ? `/incidents/${id}` : null,
    { pollMs: 30_000 },
  );

  const runAction = async (kind: 'acknowledge' | 'resolve') => {
    if (!data) return;
    setAction(kind);
    try {
      await api.post(`/incidents/${data.id}/${kind}`, undefined);
      toast.success(kind === 'acknowledge' ? 'Incident acknowledged' : 'Incident resolved');
      setConfirmResolve(false);
      refetch();
    } catch (caught) {
      toast.error(
        kind === 'acknowledge' ? 'Could not acknowledge incident' : 'Could not resolve incident',
        caught instanceof ApiError ? caught.message : 'Please try again.',
      );
    } finally {
      setAction(null);
    }
  };

  if (!id) {
    return (
      <Card>
        <EmptyState
          icon={SearchX}
          title="No incident selected"
          description="Open an incident from the list to inspect its timeline."
          action={
            <Link href="/incidents" className={buttonClasses('primary', 'sm')}>
              View incidents
            </Link>
          }
        />
      </Card>
    );
  }

  if (loading && !data) return <PageSkeleton />;
  if (error && !data) {
    return (
      <Card>
        <ErrorState message={error.message} onRetry={refetch} />
      </Card>
    );
  }
  if (!data) return <PageSkeleton />;

  const open = data.status !== 'RESOLVED';

  return (
    <div className="space-y-6">
      <Link href="/incidents" className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 transition hover:text-slate-900">
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
        Back to incidents
      </Link>

      <PageHeader
        eyebrow="Incident detail"
        title={data.title}
        description={data.description}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={refetch} leftIcon={<RefreshCw className="h-3.5 w-3.5" />}>
              Refresh
            </Button>
            {data.status === 'OPEN' ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => void runAction('acknowledge')}
                loading={action === 'acknowledge'}
                leftIcon={<BellRing className="h-3.5 w-3.5" />}
              >
                Acknowledge
              </Button>
            ) : null}
            {open ? (
              <Button
                variant="primary"
                size="sm"
                onClick={() => setConfirmResolve(true)}
                leftIcon={<CheckCircle2 className="h-3.5 w-3.5" />}
              >
                Resolve
              </Button>
            ) : null}
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <SeverityBadge severity={data.severity} />
        <IncidentStatusBadge status={data.status} />
        <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600">
          <Clock3 className="h-3 w-3" aria-hidden />
          Duration {formatDuration(data.durationSeconds)}
        </span>
        <span className="text-xs text-slate-400">Started {formatRelative(data.startedAt)}</span>
      </div>

      <MonitoringNotice text="This timeline is built from persisted check transitions and owner actions. It does not include inferred events or fabricated recovery." />

      <div className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
        <Card>
          <CardHeader title="Timeline" description="Every recorded event, oldest first" />
          <CardBody>
            {data.events.length === 0 ? (
              <EmptyState icon={FileText} title="No timeline events" description="Events are written when checks or owner actions change the incident." />
            ) : (
              <ol className="relative space-y-5 before:absolute before:bottom-2 before:left-[17px] before:top-2 before:w-px before:bg-slate-200">
                {data.events.map((event) => {
                  const meta = EVENT_META[event.eventType] ?? EVENT_META.NOTE;
                  const Icon = meta.icon;
                  return (
                    <li key={event.id} className="relative flex gap-3">
                      <span className={`relative z-10 grid h-9 w-9 shrink-0 place-items-center rounded-full ring-4 ring-white ${meta.className}`}>
                        <Icon className="h-4 w-4" aria-hidden />
                      </span>
                      <div className="min-w-0 flex-1 rounded-xl border border-slate-100 bg-slate-50/60 px-4 py-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-slate-900">{meta.label}</p>
                          <time className="text-[10px] text-slate-400" dateTime={event.createdAt}>
                            {formatDateTime(event.createdAt)}
                          </time>
                        </div>
                        <p className="mt-1 text-xs leading-5 text-slate-600">{event.description}</p>
                        {event.metadata && Object.keys(event.metadata).length > 0 ? (
                          <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                            {Object.entries(event.metadata).map(([key, value]) => (
                              <div key={key} className="flex items-center gap-1.5 text-[10px]">
                                <dt className="font-medium text-slate-400">{key}:</dt>
                                <dd className="font-mono text-slate-600">{String(value)}</dd>
                              </div>
                            ))}
                          </dl>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </CardBody>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Incident record" description="Persisted incident fields" />
            <CardBody className="space-y-3">
              {[
                ['Started', formatDateTime(data.startedAt)],
                ['Acknowledged', data.acknowledgedAt ? formatDateTime(data.acknowledgedAt) : 'Not acknowledged'],
                ['Resolved', data.resolvedAt ? formatDateTime(data.resolvedAt) : 'Ongoing'],
                ['Duration', formatDuration(data.durationSeconds)],
                ['Severity', data.severity],
                ['Status', data.status],
                ['Incident ID', data.id],
              ].map(([label, value]) => (
                <div key={label} className="flex items-start justify-between gap-4 text-xs">
                  <span className="shrink-0 text-slate-500">{label}</span>
                  <span className={`text-right font-medium ${label === 'Incident ID' ? 'break-all font-mono text-[10px]' : ''} text-slate-800`}>{value}</span>
                </div>
              ))}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Affected monitor" description="The endpoint that produced this incident" />
            <CardBody className="space-y-3">
              <div className="flex items-start gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600">
                  <ShieldCheck className="h-4 w-4" aria-hidden />
                </span>
                <div className="min-w-0">
                  <Link href={`/monitor?id=${data.monitorId}`} className="block truncate text-sm font-semibold text-slate-900 hover:text-brand-700">
                    {data.monitorName}
                  </Link>
                  <p className="mt-0.5 break-all text-xs text-slate-500">{data.monitorUrl}</p>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Link href={`/monitor?id=${data.monitorId}`} className={buttonClasses('outline', 'sm', 'w-full')}>
                  Open monitor
                </Link>
                <a href={data.monitorUrl} target="_blank" rel="noreferrer" className={buttonClasses('ghost', 'sm', 'w-full')}>
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                  Visit target
                </a>
              </div>
            </CardBody>
          </Card>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 text-xs leading-5 text-slate-500">
            <p className="font-semibold text-slate-700">Manual resolution does not rewrite history.</p>
            <p className="mt-1">
              Resolving closes the incident with an owner action. Future checks still determine the monitor&apos;s current
              state.
            </p>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmResolve}
        onClose={() => setConfirmResolve(false)}
        onConfirm={() => void runAction('resolve')}
        title="Resolve this incident?"
        description="This records a manual resolution by the account owner. It does not delete check history or fabricate a recovery observation."
        confirmLabel="Resolve incident"
        loading={action === 'resolve'}
      />
    </div>
  );
}

export default function IncidentDetailPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <IncidentDetailContent />
    </Suspense>
  );
}
