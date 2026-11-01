'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { DashboardResponse, ReportRange } from '@pulsewatch/shared';
import {
  Activity,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Clock3,
  Gauge,
  Plus,
  RefreshCw,
  Server,
  Siren,
  TriangleAlert,
} from 'lucide-react';
import { useApiQuery } from '@/lib/hooks';
import { formatMs, formatNumber, formatPercent, formatRelative, STATUS_META } from '@/lib/format';
import { PageHeader, KpiCard, MonitoringNotice } from '@/components/ui/page';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { StatusBadge, IncidentStatusBadge, SeverityBadge } from '@/components/ui/badge';
import { PageSkeleton } from '@/components/loading';
import { ErrorState, EmptyState } from '@/components/ui/states';
import { RangeTabs } from '@/components/ui/pagination';
import { AvailabilityChart, ResponseTimeChart, ChartCard } from '@/components/charts';
import { Button, buttonClasses } from '@/components/ui/button';

export default function DashboardPage() {
  const [range, setRange] = useState<ReportRange>('24h');
  const { data, error, loading, refetch } = useApiQuery<DashboardResponse>(
    `/reports/dashboard?range=${range}`,
    { pollMs: 30_000 },
  );

  if (loading && !data) return <PageSkeleton />;
  if (error && !data) {
    return (
      <div className="space-y-6">
        <PageHeader title="Dashboard" description="Live, observation-based monitoring overview." />
        <Card>
          <ErrorState message={error.message} onRetry={refetch} />
        </Card>
      </div>
    );
  }
  if (!data) return <PageSkeleton />;

  const { summary, monitors, recentIncidents, recentChecks, series } = data;
  const statusCounts = [
    { label: 'Operational', value: summary.operational, status: 'OPERATIONAL' as const },
    { label: 'Degraded', value: summary.degraded, status: 'DEGRADED' as const },
    { label: 'Down', value: summary.down, status: 'DOWN' as const },
    { label: 'Paused', value: summary.paused, status: 'PAUSED' as const },
    { label: 'Pending', value: summary.pending, status: 'PENDING' as const },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Overview"
        title="Monitoring dashboard"
        description="Every metric below is calculated from persisted observations. Missing periods remain visible as gaps."
        actions={
          <>
            <Button variant="outline" size="sm" onClick={refetch} leftIcon={<RefreshCw className="h-3.5 w-3.5" />}>
              Refresh
            </Button>
            <Link href="/monitors/new" className={buttonClasses('primary', 'sm')}>
              <Plus className="h-3.5 w-3.5" aria-hidden />
              Add monitor
            </Link>
          </>
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <RangeTabs value={range} onChange={setRange} />
        <p className="text-xs text-slate-500">
          Window: {formatRelative(data.from)} → now · refreshes every 30s while visible
        </p>
      </div>

      <MonitoringNotice text={data.monitoringNotice} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Total monitors"
          value={formatNumber(summary.totalMonitors)}
          hint={`${summary.operational} operational · ${summary.paused} paused`}
          icon={Server}
          tone="brand"
        />
        <KpiCard
          label="Observed uptime"
          value={formatPercent(summary.observedUptimePercent)}
          hint={`${formatNumber(summary.successfulChecks)} successful of ${formatNumber(summary.totalObservedChecks)} checks`}
          icon={CheckCircle2}
          tone={summary.observedUptimePercent === null ? 'neutral' : summary.observedUptimePercent >= 99 ? 'good' : 'warning'}
        />
        <KpiCard
          label="Average response"
          value={formatMs(summary.averageResponseTimeMs)}
          hint="Mean of observed response times"
          icon={Gauge}
          tone="neutral"
        />
        <KpiCard
          label="Open incidents"
          value={formatNumber(summary.openIncidents)}
          hint={`${summary.down} down · ${summary.degraded} degraded`}
          icon={Siren}
          tone={summary.openIncidents > 0 ? 'danger' : 'good'}
        />
      </div>

      {summary.staleMonitors > 0 ? (
        <div className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" aria-hidden />
            <div>
              <p className="text-sm font-semibold text-amber-900">
                {summary.staleMonitors} monitor{summary.staleMonitors === 1 ? '' : 's'} have stale observations
              </p>
              <p className="mt-0.5 text-xs text-amber-800">
                The API may have been asleep, or a check may be overdue. PulseWatch will resume overdue monitors when it
                wakes; it will not invent results for the gap.
              </p>
            </div>
          </div>
          <Link href="/monitors" className="text-xs font-semibold text-amber-900 underline-offset-4 hover:underline">
            Review monitors
          </Link>
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[1.35fr_0.65fr]">
        <ChartCard
          title="Availability trend"
          description="Observed uptime per bucket. Empty buckets are gaps, not 100%."
          actions={<span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">Observed</span>}
        >
          <AvailabilityChart series={series} />
        </ChartCard>

        <Card>
          <CardHeader title="Current state" description="Monitor states across the workspace" />
          <CardBody className="space-y-2.5">
            {statusCounts.map((item) => (
              <div key={item.label} className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/60 px-3.5 py-2.5">
                <span className="flex items-center gap-2 text-sm text-slate-700">
                  <span className={`h-2 w-2 rounded-full ${STATUS_META[item.status].dot}`} aria-hidden />
                  {item.label}
                </span>
                <span className="text-sm font-semibold text-slate-900">{item.value}</span>
              </div>
            ))}
            <div className="rounded-xl border border-slate-100 bg-white px-3.5 py-2.5">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Monitoring coverage</span>
                <span className="font-semibold text-slate-700">{formatPercent(summary.monitoringCoveragePercent, 1)}</span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-brand-500 to-accent-500"
                  style={{ width: `${Math.max(0, Math.min(100, summary.monitoringCoveragePercent ?? 0))}%` }}
                />
              </div>
              <p className="mt-2 text-[10px] text-slate-400">Expected checks compared with observations</p>
            </div>
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <ChartCard title="Response-time trend" description="Average observed latency per bucket">
          <ResponseTimeChart series={series} />
        </ChartCard>
        <Card>
          <CardHeader
            title="Monitors"
            description="Latest state and check summary"
            actions={
              <Link href="/monitors" className="text-xs font-semibold text-brand-600 hover:text-brand-700">
                View all
              </Link>
            }
          />
          {monitors.length === 0 ? (
            <EmptyState
              icon={Activity}
              title="No monitors yet"
              description="Register an endpoint to begin collecting real observations."
              action={
                <Link href="/monitors/new" className={buttonClasses('primary', 'sm')}>
                  <Plus className="h-3.5 w-3.5" aria-hidden />
                  Create monitor
                </Link>
              }
            />
          ) : (
            <ul className="divide-y divide-slate-100">
              {monitors.map((monitor) => (
                <li key={monitor.id}>
                  <Link href={`/monitor?id=${monitor.id}`} className="flex items-center gap-3 px-5 py-3.5 transition hover:bg-slate-50">
                    <span className={`h-2 w-2 shrink-0 rounded-full ${STATUS_META[monitor.currentStatus].dot}`} aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-900">{monitor.name}</p>
                      <p className="truncate text-xs text-slate-500">{monitor.targetUrl}</p>
                    </div>
                    <div className="hidden text-right sm:block">
                      <p className="text-xs font-medium text-slate-700">{formatMs(monitor.latestCheck?.responseTimeMs)}</p>
                      <p className="text-[10px] text-slate-400">{formatRelative(monitor.lastCheckedAt)}</p>
                    </div>
                    <StatusBadge status={monitor.currentStatus} />
                    <ArrowRight className="h-4 w-4 text-slate-300" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader
            title="Recent incidents"
            description="Newest incident records across monitors"
            actions={
              <Link href="/incidents" className="text-xs font-semibold text-brand-600 hover:text-brand-700">
                Manage incidents
              </Link>
            }
          />
          {recentIncidents.length === 0 ? (
            <EmptyState icon={Siren} title="No incidents recorded" description="Incidents open only after a monitor reaches its failure threshold." />
          ) : (
            <ul className="divide-y divide-slate-100">
              {recentIncidents.map((incident) => (
                <li key={incident.id}>
                  <Link href={`/incidents/detail?id=${incident.id}`} className="block px-5 py-4 transition hover:bg-slate-50">
                    <div className="flex flex-wrap items-center gap-2">
                      <SeverityBadge severity={incident.severity} />
                      <IncidentStatusBadge status={incident.status} />
                      <span className="text-[10px] text-slate-400">{formatRelative(incident.startedAt)}</span>
                    </div>
                    <p className="mt-2 text-sm font-semibold text-slate-900">{incident.title}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{incident.monitorName}</p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader
            title="Latest monitoring activity"
            description="Persisted check results, newest first"
            actions={
              <Link href="/reports" className="text-xs font-semibold text-brand-600 hover:text-brand-700">
                Open reports
              </Link>
            }
          />
          {recentChecks.length === 0 ? (
            <EmptyState icon={Clock3} title="No checks yet" description="Run a manual check or wait for the scheduler." />
          ) : (
            <ul className="divide-y divide-slate-100">
              {recentChecks.map((check) => (
                <li key={check.id} className="flex items-center gap-3 px-5 py-3">
                  <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg ${check.successful ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                    {check.successful ? <CheckCircle2 className="h-4 w-4" aria-hidden /> : <TriangleAlert className="h-4 w-4" aria-hidden />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-800">{check.monitorName}</p>
                    <p className="text-[11px] text-slate-500">
                      {check.httpStatus ? `HTTP ${check.httpStatus}` : check.errorCode ?? 'No response'} · {formatMs(check.responseTimeMs)}
                    </p>
                  </div>
                  <span className="text-[10px] text-slate-400">{formatRelative(check.checkedAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card>
        <CardHeader title="Quick actions" description="Common monitoring workflows" />
        <CardBody className="grid gap-3 sm:grid-cols-3">
          <Link href="/monitors/new" className="group rounded-xl border border-slate-200 p-4 transition hover:border-brand-200 hover:bg-brand-50/40">
            <Plus className="h-5 w-5 text-brand-600" aria-hidden />
            <p className="mt-3 text-sm font-semibold text-slate-900">Add a monitor</p>
            <p className="mt-1 text-xs text-slate-500">Register an endpoint and start with a real check.</p>
          </Link>
          <Link href="/incidents" className="group rounded-xl border border-slate-200 p-4 transition hover:border-brand-200 hover:bg-brand-50/40">
            <Siren className="h-5 w-5 text-rose-500" aria-hidden />
            <p className="mt-3 text-sm font-semibold text-slate-900">Review incidents</p>
            <p className="mt-1 text-xs text-slate-500">Acknowledge, resolve, and inspect event timelines.</p>
          </Link>
          <Link href="/reports" className="group rounded-xl border border-slate-200 p-4 transition hover:border-brand-200 hover:bg-brand-50/40">
            <BarChart3 className="h-5 w-5 text-accent-600" aria-hidden />
            <p className="mt-3 text-sm font-semibold text-slate-900">Historical reports</p>
            <p className="mt-1 text-xs text-slate-500">Compare observed availability and latency windows.</p>
          </Link>
        </CardBody>
      </Card>
    </div>
  );
}
