'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { ReportRange, ReportsOverviewResponse } from '@pulsewatch/shared';
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Clock3,
  Gauge,
  RefreshCw,
  Siren,
  TriangleAlert,
} from 'lucide-react';
import { useApiQuery } from '@/lib/hooks';
import {
  formatDuration,
  formatMs,
  formatNumber,
  formatPercent,
  formatRelative,
  STATUS_META,
} from '@/lib/format';
import { PageHeader, KpiCard, MonitoringNotice } from '@/components/ui/page';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RangeTabs } from '@/components/ui/pagination';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { PageSkeleton } from '@/components/loading';
import { AvailabilityChart, ResponseTimeChart, StatusDistributionChart, ChartCard } from '@/components/charts';

export default function ReportsPage() {
  const [range, setRange] = useState<ReportRange>('24h');
  const { data, error, loading, refetch } = useApiQuery<ReportsOverviewResponse>(
    `/reports/overview?range=${range}`,
    { pollMs: 60_000 },
  );

  if (loading && !data) return <PageSkeleton />;
  if (error && !data) {
    return (
      <div className="space-y-6">
        <PageHeader title="Reports" description="Observation-based availability and incident reporting." />
        <Card><ErrorState message={error.message} onRetry={refetch} /></Card>
      </div>
    );
  }
  if (!data) return <PageSkeleton />;

  const { summary, series, statusDistribution, monitors, recurringFailures, incidents } = data;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Historical evidence"
        title="Reports"
        description="Availability, latency, coverage, and incident history calculated from persisted check results only."
        actions={
          <Button variant="outline" size="sm" onClick={refetch} leftIcon={<RefreshCw className="h-3.5 w-3.5" />}>
            Refresh
          </Button>
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <RangeTabs value={range} onChange={setRange} />
        <p className="text-xs text-slate-500">
          {formatRelative(data.from)} → {formatRelative(data.to)} · window recalculated on refresh
        </p>
      </div>

      <MonitoringNotice text={data.monitoringNotice} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Observed uptime"
          value={formatPercent(summary.observedUptimePercent)}
          hint={`${formatNumber(summary.successfulChecks)} successful / ${formatNumber(summary.totalObservedChecks)} checks`}
          icon={CheckCircle2}
          tone={
            summary.observedUptimePercent === null
              ? 'neutral'
              : summary.observedUptimePercent >= 99
                ? 'good'
                : summary.observedUptimePercent >= 95
                  ? 'warning'
                  : 'danger'
          }
        />
        <KpiCard
          label="Average latency"
          value={formatMs(summary.averageResponseTimeMs)}
          hint="Mean observed response time"
          icon={Gauge}
          tone="brand"
        />
        <KpiCard
          label="Coverage"
          value={formatPercent(summary.monitoringCoveragePercent, 1)}
          hint={`${formatNumber(summary.staleMonitors)} stale monitor${summary.staleMonitors === 1 ? '' : 's'}`}
          icon={Clock3}
          tone={
            summary.monitoringCoveragePercent === null
              ? 'neutral'
              : summary.monitoringCoveragePercent >= 95
                ? 'good'
                : 'warning'
          }
        />
        <KpiCard
          label="Incidents in window"
          value={formatNumber(incidents.total)}
          hint={`${incidents.open} open · ${incidents.resolved} resolved`}
          icon={Siren}
          tone={incidents.open > 0 ? 'danger' : 'good'}
        />
      </div>

      {summary.monitoringCoveragePercent !== null && summary.monitoringCoveragePercent < 80 ? (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <div>
            <p className="font-semibold">Coverage is below 80% in this window.</p>
            <p className="mt-0.5 text-xs leading-5 text-amber-800">
              Free hosting can sleep. Missing observations are excluded from uptime and shown here instead of being
              counted as healthy.
            </p>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-2">
        <ChartCard title="Availability by bucket" description="Only buckets with observations have an uptime value.">
          <AvailabilityChart series={series} />
        </ChartCard>
        <ChartCard title="Latency by bucket" description="Average of observed response times; gaps stay empty.">
          <ResponseTimeChart series={series} />
        </ChartCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.35fr_0.65fr]">
        <Card className="overflow-hidden">
          <CardHeader
            title="Monitor comparison"
            description="Observed performance for every monitor in this workspace"
            actions={<span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">{monitors.length} monitors</span>}
          />
          {monitors.length === 0 ? (
            <EmptyState
              icon={BarChart3}
              title="No monitors to report on"
              description="Create a monitor and record a check to populate this report."
              action={
                <Link href="/monitors/new" className="text-sm font-semibold text-brand-600 hover:text-brand-700">
                  Create monitor
                </Link>
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-left">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">
                    <th className="px-5 py-3">Monitor</th>
                    <th className="px-5 py-3">State</th>
                    <th className="px-5 py-3">Observed</th>
                    <th className="px-5 py-3">Uptime</th>
                    <th className="px-5 py-3">Avg response</th>
                    <th className="px-5 py-3">Incidents</th>
                    <th className="px-5 py-3">Coverage</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {monitors.map((monitor) => (
                    <tr key={monitor.monitorId} className="text-xs transition hover:bg-slate-50/70">
                      <td className="px-5 py-3.5">
                        <div className="flex items-start gap-2.5">
                          <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${STATUS_META[monitor.currentStatus].dot}`} aria-hidden />
                          <div className="min-w-0">
                            <p className="max-w-[240px] truncate text-sm font-semibold text-slate-900">{monitor.name}</p>
                            <p className="max-w-[240px] truncate text-[10px] text-slate-400">{monitor.targetUrl}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5"><StatusBadge status={monitor.currentStatus} /></td>
                      <td className="px-5 py-3.5 text-slate-700">
                        {formatNumber(monitor.observedChecks)}
                        <span className="ml-1 text-[10px] text-slate-400">({formatNumber(monitor.failedChecks)} failed)</span>
                      </td>
                      <td className="px-5 py-3.5 font-semibold text-slate-800">{formatPercent(monitor.observedUptimePercent)}</td>
                      <td className="px-5 py-3.5 text-slate-700">{formatMs(monitor.averageResponseTimeMs)}</td>
                      <td className="px-5 py-3.5 text-slate-700">
                        {monitor.incidentCount}
                        <span className="ml-1 text-[10px] text-slate-400">{formatDuration(monitor.totalIncidentDurationSeconds)}</span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`font-semibold ${monitor.coveragePercent !== null && monitor.coveragePercent < 80 ? 'text-amber-700' : 'text-slate-700'}`}>
                          {formatPercent(monitor.coveragePercent, 1)}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <Link href={`/monitor?id=${monitor.monitorId}`} className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-600 hover:text-brand-700">
                          Open
                          <ArrowRight className="h-3 w-3" aria-hidden />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Incident summary" description="Incidents started in this window" />
            <CardBody className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                {[
                  ['Total', incidents.total],
                  ['Open', incidents.open],
                  ['Acknowledged', incidents.acknowledged],
                  ['Resolved', incidents.resolved],
                ].map(([label, value]) => (
                  <div key={String(label)} className="rounded-xl border border-slate-100 bg-slate-50/70 px-3.5 py-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">{label}</p>
                    <p className="mt-1 text-xl font-semibold text-slate-900">{value}</p>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between rounded-xl border border-slate-100 px-3.5 py-2.5 text-xs">
                <span className="text-slate-500">Average resolution</span>
                <span className="font-semibold text-slate-800">{formatDuration(incidents.averageDurationSeconds)}</span>
              </div>
              <div className="space-y-2">
                {(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const).map((severity) => {
                  const count = incidents.bySeverity[severity] ?? 0;
                  const max = Math.max(1, ...Object.values(incidents.bySeverity));
                  return (
                    <div key={severity}>
                      <div className="flex items-center justify-between text-[10px] font-medium text-slate-500">
                        <span>{severity}</span>
                        <span>{count}</span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className={`h-full rounded-full ${
                            severity === 'CRITICAL'
                              ? 'bg-rose-500'
                              : severity === 'HIGH'
                                ? 'bg-amber-500'
                                : severity === 'MEDIUM'
                                  ? 'bg-sky-500'
                                  : 'bg-slate-400'
                          }`}
                          style={{ width: `${Math.min(100, (count / max) * 100)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="HTTP status mix" description="Persisted status codes in the window" />
            <CardBody className="pt-1">
              <StatusDistributionChart data={statusDistribution} />
            </CardBody>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader
          title="Recurring failures"
          description="Monitors with two or more incidents in this window, ranked by incident count."
          actions={
            <Link href="/incidents" className="text-xs font-semibold text-brand-600 hover:text-brand-700">
              Review incidents
            </Link>
          }
        />
        {recurringFailures.length === 0 ? (
          <EmptyState
            icon={CheckCircle2}
            title="No recurring incidents in this window"
            description="A monitor appears here only when it has at least two recorded incidents in the selected range."
          />
        ) : (
          <ul className="divide-y divide-slate-100">
            {recurringFailures.map((monitor) => (
              <li key={monitor.monitorId} className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <Link href={`/monitor?id=${monitor.monitorId}`} className="text-sm font-semibold text-slate-900 hover:text-brand-700">
                    {monitor.name}
                  </Link>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {monitor.incidentCount} incidents · {formatNumber(monitor.failedChecks)} failed checks · {formatDuration(monitor.totalIncidentDurationSeconds)} total duration
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-semibold text-amber-700">{formatPercent(monitor.observedUptimePercent)} uptime</span>
                  <Link href={`/monitor?id=${monitor.monitorId}`} className="text-xs font-semibold text-brand-600 hover:text-brand-700">
                    Inspect
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
