'use client';

import Link from 'next/link';
import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type {
  CheckResult,
  IncidentSummary,
  Monitor,
  MonitorStatsResponse,
  Paginated,
  ReportRange,
} from '@pulsewatch/shared';
import {
  Activity,
  ArrowLeft,
  CheckCircle2,
  Clock3,
  ExternalLink,
  Gauge,
  Pause,
  Pencil,
  Play,
  RefreshCw,
  SearchX,
  ShieldCheck,
  Siren,
  Trash2,
  TriangleAlert,
} from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { useApiQuery } from '@/lib/hooks';
import { useToast } from '@/components/toast';
import { formatDateTime, formatDuration, formatMs, formatNumber, formatPercent, formatRelative, STATUS_META } from '@/lib/format';
import { PageHeader, KpiCard, MonitoringNotice } from '@/components/ui/page';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { StatusBadge, IncidentStatusBadge, SeverityBadge } from '@/components/ui/badge';
import { Button, buttonClasses } from '@/components/ui/button';
import { RangeTabs, Pagination } from '@/components/ui/pagination';
import { ConfirmDialog } from '@/components/ui/modal';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { PageSkeleton } from '@/components/loading';
import { AvailabilityChart, ResponseTimeChart, StatusDistributionChart, ChartCard } from '@/components/charts';

const CHECK_PAGE_SIZE = 10;

function MonitorDetailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const toast = useToast();
  const id = searchParams.get('id');
  const [range, setRange] = useState<ReportRange>('24h');
  const [checkPage, setCheckPage] = useState(1);
  const [checking, setChecking] = useState(false);
  const [statusSaving, setStatusSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const monitorQuery = useApiQuery<Monitor>(id ? `/monitors/${id}` : null, { pollMs: 30_000 });
  const statsQuery = useApiQuery<MonitorStatsResponse>(
    id ? `/reports/monitors/${id}?range=${range}` : null,
    { pollMs: 30_000 },
  );
  const checksQuery = useApiQuery<Paginated<CheckResult>>(
    id ? `/monitors/${id}/checks?page=${checkPage}&pageSize=${CHECK_PAGE_SIZE}` : null,
    { pollMs: 30_000 },
  );
  const incidentsQuery = useApiQuery<Paginated<IncidentSummary>>(
    id ? `/incidents?monitorId=${id}&pageSize=5&page=1` : null,
    { pollMs: 30_000 },
  );

  const monitor = monitorQuery.data;
  const stats = statsQuery.data;
  const checks = checksQuery.data;

  const refetchAll = () => {
    monitorQuery.refetch();
    statsQuery.refetch();
    checksQuery.refetch();
    incidentsQuery.refetch();
  };

  const handleCheck = async () => {
    if (!monitor) return;
    setChecking(true);
    try {
      const result = await api.post<{ check: CheckResult }>(`/monitors/${monitor.id}/check`, undefined);
      toast.success(
        result.check.successful ? 'Check succeeded' : 'Check recorded a failure',
        result.check.successful
          ? `HTTP ${result.check.httpStatus ?? '—'} in ${formatMs(result.check.responseTimeMs)}.`
          : result.check.sanitizedErrorMessage ?? result.check.errorCode ?? 'The endpoint did not pass this check.',
      );
      setCheckPage(1);
      refetchAll();
    } catch (caught) {
      toast.error('Check could not run', caught instanceof ApiError ? caught.message : 'Please try again.');
    } finally {
      setChecking(false);
    }
  };

  const handlePauseResume = async () => {
    if (!monitor) return;
    setStatusSaving(true);
    try {
      await api.post(`/monitors/${monitor.id}/${monitor.pausedAt ? 'resume' : 'pause'}`, undefined);
      toast.success(monitor.pausedAt ? 'Monitoring resumed' : 'Monitoring paused');
      refetchAll();
    } catch (caught) {
      toast.error('Could not update monitoring', caught instanceof ApiError ? caught.message : 'Please try again.');
    } finally {
      setStatusSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!monitor) return;
    setDeleting(true);
    try {
      await api.delete(`/monitors/${monitor.id}`);
      toast.success('Monitor deleted', 'Its check results and incidents were removed with it.');
      router.push('/monitors');
    } catch (caught) {
      toast.error('Could not delete monitor', caught instanceof ApiError ? caught.message : 'Please try again.');
      setDeleting(false);
    }
  };

  if (!id) {
    return (
      <Card>
        <EmptyState
          icon={SearchX}
          title="No monitor selected"
          description="Choose a monitor from the list to inspect its observations."
          action={
            <Link href="/monitors" className={buttonClasses('primary', 'sm')}>
              View monitors
            </Link>
          }
        />
      </Card>
    );
  }

  if (monitorQuery.loading && !monitor) return <PageSkeleton />;
  if (monitorQuery.error && !monitor) {
    return (
      <Card>
        <ErrorState message={monitorQuery.error.message} onRetry={monitorQuery.refetch} />
      </Card>
    );
  }
  if (!monitor) return <PageSkeleton />;

  const summary = stats?.summary;
  const latest = monitor.latestCheck;

  return (
    <div className="space-y-6">
      <Link href="/monitors" className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 transition hover:text-slate-900">
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
        Back to monitors
      </Link>

      <PageHeader
        eyebrow="Monitor detail"
        title={monitor.name}
        description={monitor.description ?? 'No description provided.'}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={refetchAll} leftIcon={<RefreshCw className="h-3.5 w-3.5" />}>
              Refresh
            </Button>
            <Link href={`/monitors/edit?id=${monitor.id}`} className={buttonClasses('outline', 'sm')}>
              <Pencil className="h-3.5 w-3.5" aria-hidden />
              Edit
            </Link>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void handlePauseResume()}
              loading={statusSaving}
              leftIcon={monitor.pausedAt ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
            >
              {monitor.pausedAt ? 'Resume' : 'Pause'}
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => void handleCheck()}
              loading={checking}
              disabled={Boolean(monitor.pausedAt)}
              leftIcon={<Activity className="h-3.5 w-3.5" />}
            >
              Check now
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setDeleteOpen(true)}
              aria-label="Delete monitor"
              title="Delete monitor"
            >
              <Trash2 className="h-4 w-4 text-rose-600" />
            </Button>
          </>
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={monitor.currentStatus} />
          <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600">
            {monitor.method}
          </span>
          {monitor.hasCustomHeaders ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
              <ShieldCheck className="h-3 w-3" aria-hidden />
              {monitor.headerNames.length} encrypted header{monitor.headerNames.length === 1 ? '' : 's'}
            </span>
          ) : null}
          {monitor.isStale ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
              <TriangleAlert className="h-3 w-3" aria-hidden />
              Stale observation
            </span>
          ) : null}
          {monitor.pausedAt ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
              <Pause className="h-3 w-3" aria-hidden />
              Paused {formatRelative(monitor.pausedAt)}
            </span>
          ) : null}
        </div>
        <RangeTabs value={range} onChange={setRange} />
      </div>

      <MonitoringNotice text="Uptime is successful recorded checks divided by all recorded checks. Missing intervals are not counted as successes or failures." />

      {monitor.isStale || summary?.monitoringGap ? (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <div>
            <p className="font-semibold">Monitoring coverage is incomplete in this window.</p>
            <p className="mt-0.5 text-xs leading-5 text-amber-800">
              This is a visible gap, not an inferred outage. The scheduler will queue overdue work when the API is awake.
            </p>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Observed uptime"
          value={formatPercent(summary?.observedUptimePercent ?? null)}
          hint={`${formatNumber(summary?.successfulChecks ?? 0)} of ${formatNumber(summary?.observedChecks ?? 0)} checks`}
          icon={CheckCircle2}
          tone={
            summary?.observedUptimePercent == null
              ? 'neutral'
              : summary.observedUptimePercent >= 99
                ? 'good'
                : 'warning'
          }
        />
        <KpiCard
          label="Average response"
          value={formatMs(summary?.averageResponseTimeMs ?? null)}
          hint={`P95 ${formatMs(summary?.p95ResponseTimeMs ?? null)}`}
          icon={Gauge}
          tone="brand"
        />
        <KpiCard
          label="Coverage"
          value={formatPercent(summary?.coveragePercent ?? null, 1)}
          hint="Observed checks vs expected cadence"
          icon={Clock3}
          tone={summary?.monitoringGap ? 'warning' : 'good'}
        />
        <KpiCard
          label="Incidents"
          value={formatNumber(summary?.incidentCount ?? 0)}
          hint={`${summary?.openIncidentCount ?? 0} currently open · ${formatDuration(summary?.totalIncidentDurationSeconds)} total`}
          icon={Siren}
          tone={(summary?.openIncidentCount ?? 0) > 0 ? 'danger' : 'good'}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
        <ChartCard
          title="Observed availability"
          description="Uptime per bucket. Empty buckets are gaps, never 100%."
        >
          {stats ? <AvailabilityChart series={stats.series} /> : <PageSkeleton />}
        </ChartCard>
        <Card>
          <CardHeader title="Configuration" description="Applied to every future check" />
          <CardBody className="space-y-3">
            <div className="flex items-start justify-between gap-4 rounded-xl bg-slate-50/80 px-3.5 py-2.5">
              <span className="text-xs text-slate-500">Target URL</span>
              <a
                href={monitor.targetUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex max-w-[70%] items-center gap-1 truncate text-right text-xs font-medium text-brand-700 hover:text-brand-800"
              >
                <span className="truncate">{monitor.targetUrl}</span>
                <ExternalLink className="h-3 w-3 shrink-0" aria-hidden />
              </a>
            </div>
            {[
              ['Method', monitor.method],
              ['Interval', `${monitor.intervalSeconds}s`],
              ['Timeout', `${monitor.timeoutMs}ms`],
              ['Expected status', `${monitor.expectedStatusMin}–${monitor.expectedStatusMax}`],
              ['Failure threshold', `${monitor.failureThreshold} consecutive`],
              ['Recovery threshold', `${monitor.recoveryThreshold} consecutive`],
              ['Slow threshold', `${monitor.degradedResponseTimeMs}ms`],
              ['Created', formatDateTime(monitor.createdAt)],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between gap-4 px-1 text-xs">
                <span className="text-slate-500">{label}</span>
                <span className="text-right font-medium text-slate-800">{value}</span>
              </div>
            ))}
            {monitor.headerNames.length > 0 ? (
              <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 px-3.5 py-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-700">Encrypted headers</p>
                <p className="mt-1 break-words text-xs text-emerald-900">{monitor.headerNames.join(', ')}</p>
                <p className="mt-1 text-[10px] text-emerald-700">Values are never returned by the API.</p>
              </div>
            ) : null}
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <ChartCard title="Response-time trend" description="Average observed latency per bucket">
          {stats ? <ResponseTimeChart series={stats.series} /> : <PageSkeleton />}
        </ChartCard>
        <ChartCard title="HTTP status distribution" description="Every recorded response status in the window">
          {stats ? <StatusDistributionChart data={stats.statusDistribution} /> : <PageSkeleton />}
        </ChartCard>
      </div>

      <Card className="overflow-hidden">
        <CardHeader
          title="Check history"
          description="Persisted observations, newest first. Each row is a real request."
          actions={
            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
              {checks ? `${checks.pagination.total} total` : 'Loading'}
            </span>
          }
        />
        {checksQuery.loading && !checks ? (
          <div className="p-5"><PageSkeleton /></div>
        ) : checksQuery.error && !checks ? (
          <ErrorState message={checksQuery.error.message} onRetry={checksQuery.refetch} />
        ) : !checks || checks.items.length === 0 ? (
          <EmptyState
            icon={Activity}
            title="No checks recorded yet"
            description={monitor.pausedAt ? 'Resume the monitor to collect observations.' : 'Run a manual check or wait for the scheduler.'}
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] text-left">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">
                    <th className="px-5 py-3">Result</th>
                    <th className="px-5 py-3">Checked at</th>
                    <th className="px-5 py-3">HTTP</th>
                    <th className="px-5 py-3">Response</th>
                    <th className="px-5 py-3">Source</th>
                    <th className="px-5 py-3">Detail</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {checks.items.map((check) => (
                    <tr key={check.id} className="text-xs">
                      <td className="px-5 py-3">
                        <span className={`inline-flex items-center gap-1.5 font-semibold ${check.successful ? 'text-emerald-700' : 'text-rose-700'}`}>
                          <span className={`h-2 w-2 rounded-full ${check.successful ? 'bg-emerald-500' : 'bg-rose-500'}`} aria-hidden />
                          {check.successful ? 'Success' : 'Failed'}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-slate-600">{formatDateTime(check.checkedAt)}</td>
                      <td className="px-5 py-3 text-slate-700">{check.httpStatus ?? '—'}</td>
                      <td className="px-5 py-3 text-slate-700">{formatMs(check.responseTimeMs)}</td>
                      <td className="px-5 py-3">
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                          {check.source}
                        </span>
                      </td>
                      <td className="max-w-[320px] px-5 py-3 text-slate-500">
                        <span className="block truncate" title={check.sanitizedErrorMessage ?? check.errorCode ?? ''}>
                          {check.sanitizedErrorMessage ?? check.errorCode ?? 'Within expected range'}
                        </span>
                        {check.redirectCount > 0 ? (
                          <span className="text-[10px] text-slate-400">{check.redirectCount} redirect(s)</span>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination pagination={checks.pagination} onPageChange={setCheckPage} />
          </>
        )}
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader
            title="Recent incidents"
            description="Incidents are opened only after the failure threshold."
            actions={
              <Link href={`/incidents?monitorId=${monitor.id}`} className="text-xs font-semibold text-brand-600 hover:text-brand-700">
                View all
              </Link>
            }
          />
          {!incidentsQuery.data || incidentsQuery.data.items.length === 0 ? (
            <EmptyState icon={Siren} title="No incidents recorded" description="A healthy monitor with no threshold breaches has no incidents." />
          ) : (
            <ul className="divide-y divide-slate-100">
              {incidentsQuery.data.items.map((incident) => (
                <li key={incident.id}>
                  <Link href={`/incidents/detail?id=${incident.id}`} className="block px-5 py-4 transition hover:bg-slate-50">
                    <div className="flex flex-wrap items-center gap-2">
                      <SeverityBadge severity={incident.severity} />
                      <IncidentStatusBadge status={incident.status} />
                      <span className="text-[10px] text-slate-400">{formatRelative(incident.startedAt)}</span>
                    </div>
                    <p className="mt-2 text-sm font-semibold text-slate-900">{incident.title}</p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title="Latest observation" description="The newest persisted check result" />
          {!latest ? (
            <EmptyState icon={Clock3} title="No observation yet" description="The first check will appear here after it completes." />
          ) : (
            <CardBody className="space-y-4">
              <div className={`flex items-start gap-3 rounded-xl px-4 py-3 ${latest.successful ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'}`}>
                {latest.successful ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" aria-hidden /> : <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />}
                <div>
                  <p className="text-sm font-semibold">{latest.successful ? 'Check succeeded' : 'Check failed'}</p>
                  <p className="mt-0.5 text-xs">{formatDateTime(latest.checkedAt)}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  ['HTTP status', latest.httpStatus ?? '—'],
                  ['Response time', formatMs(latest.responseTimeMs)],
                  ['Source', latest.source],
                  ['Redirects', latest.redirectCount],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-xl border border-slate-100 bg-slate-50/70 px-3.5 py-2.5">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">{label}</p>
                    <p className="mt-1 text-sm font-semibold text-slate-800">{value}</p>
                  </div>
                ))}
              </div>
              {latest.sanitizedErrorMessage ? (
                <p className="rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-600">
                  {latest.sanitizedErrorMessage}
                </p>
              ) : null}
            </CardBody>
          )}
        </Card>
      </div>

      <p className="text-xs text-slate-400">
        Monitor ID <span className="font-mono">{monitor.id}</span> · State values are derived from persisted checks, not manual claims.
      </p>

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={() => void handleDelete()}
        title="Delete this monitor?"
        description="This permanently removes the monitor, every check result, and every incident timeline attached to it. This cannot be undone."
        confirmLabel="Delete monitor"
        loading={deleting}
        destructive
      />
    </div>
  );
}

export default function MonitorDetailPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <MonitorDetailContent />
    </Suspense>
  );
}
