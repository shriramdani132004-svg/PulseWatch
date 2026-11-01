'use client';

import Link from 'next/link';
import { Suspense, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import type { IncidentSeverity, IncidentStatus, IncidentSummary, Paginated } from '@pulsewatch/shared';
import { ArrowRight, CheckCircle2, RefreshCw, Search, Siren, TriangleAlert, X } from 'lucide-react';
import { useApiQuery, useDebouncedValue } from '@/lib/hooks';
import { formatDuration, formatRelative } from '@/lib/format';
import { PageHeader, KpiCard, MonitoringNotice } from '@/components/ui/page';
import { Card } from '@/components/ui/card';
import { IncidentStatusBadge, SeverityBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/field';
import { Pagination } from '@/components/ui/pagination';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { PageSkeleton } from '@/components/loading';

interface IncidentSummaryResponse {
  open: number;
  byStatus: Record<string, number>;
  bySeverity: Record<string, number>;
}

const PAGE_SIZE = 15;

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'OPEN', label: 'Open' },
  { value: 'ACKNOWLEDGED', label: 'Acknowledged' },
  { value: 'RESOLVED', label: 'Resolved' },
];

const SEVERITY_OPTIONS = [
  { value: '', label: 'All severities' },
  { value: 'CRITICAL', label: 'Critical' },
  { value: 'HIGH', label: 'High' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'LOW', label: 'Low' },
];

function IncidentsContent() {
  const searchParams = useSearchParams();
  const monitorId = searchParams.get('monitorId');
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<IncidentStatus | ''>('');
  const [severity, setSeverity] = useState<IncidentSeverity | ''>('');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search.trim(), 350);

  const path = useMemo(() => {
    const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
    if (monitorId) params.set('monitorId', monitorId);
    if (status) params.set('status', status);
    if (severity) params.set('severity', severity);
    if (debouncedSearch) params.set('search', debouncedSearch);
    return `/incidents?${params.toString()}`;
  }, [monitorId, page, status, severity, debouncedSearch]);

  const listQuery = useApiQuery<Paginated<IncidentSummary>>(path, { pollMs: 30_000 });
  const summaryQuery = useApiQuery<IncidentSummaryResponse>('/incidents/summary', { pollMs: 30_000 });

  const summary = summaryQuery.data;
  const total = summary ? Object.values(summary.byStatus).reduce((sum, count) => sum + count, 0) : null;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Incident management"
        title="Incidents"
        description="An incident opens only after a monitor reaches its configured failure threshold. Every transition is recorded on its timeline."
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              listQuery.refetch();
              summaryQuery.refetch();
            }}
            leftIcon={<RefreshCw className="h-3.5 w-3.5" />}
          >
            Refresh
          </Button>
        }
      />

      {monitorId ? (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-800">
          <p className="inline-flex items-center gap-2">
            <Siren className="h-4 w-4" aria-hidden />
            Showing incidents for one monitor.
          </p>
          <Link href="/incidents" className="inline-flex items-center gap-1 text-xs font-semibold hover:underline">
            <X className="h-3.5 w-3.5" aria-hidden />
            Clear monitor filter
          </Link>
        </div>
      ) : null}

      <MonitoringNotice text="Incident duration is the time between the recorded start and resolution. Open incidents remain ongoing until a real recovery or a manual resolution." />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Total incidents"
          value={summary ? total ?? 0 : '—'}
          hint="All recorded incident states"
          icon={Siren}
          tone="brand"
        />
        <KpiCard
          label="Open"
          value={summary?.byStatus.OPEN ?? 0}
          hint="Awaiting acknowledgement or recovery"
          icon={TriangleAlert}
          tone={(summary?.byStatus.OPEN ?? 0) > 0 ? 'danger' : 'good'}
        />
        <KpiCard
          label="Acknowledged"
          value={summary?.byStatus.ACKNOWLEDGED ?? 0}
          hint="Owner is aware; recovery still pending"
          icon={CheckCircle2}
          tone={(summary?.byStatus.ACKNOWLEDGED ?? 0) > 0 ? 'warning' : 'neutral'}
        />
        <KpiCard
          label="Resolved"
          value={summary?.byStatus.RESOLVED ?? 0}
          hint="Closed by verified recovery or owner action"
          icon={CheckCircle2}
          tone="good"
        />
      </div>

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
            <input
              type="search"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Search incidents by title, description, or monitor"
              aria-label="Search incidents"
              className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-900 shadow-sm transition placeholder:text-slate-400 hover:border-slate-300 focus:border-brand-400 focus:outline-none focus:ring-4 focus:ring-brand-500/10"
            />
          </div>
          <div className="grid grid-cols-2 gap-3 lg:w-[340px]">
            <Select
              label="Status"
              value={status}
              onChange={(event) => {
                setStatus(event.target.value as IncidentStatus | '');
                setPage(1);
              }}
              options={STATUS_OPTIONS}
              containerClassName="space-y-0"
            />
            <Select
              label="Severity"
              value={severity}
              onChange={(event) => {
                setSeverity(event.target.value as IncidentSeverity | '');
                setPage(1);
              }}
              options={SEVERITY_OPTIONS}
              containerClassName="space-y-0"
            />
          </div>
        </div>

        {listQuery.loading && !listQuery.data ? (
          <div className="p-5"><PageSkeleton /></div>
        ) : listQuery.error && !listQuery.data ? (
          <ErrorState message={listQuery.error.message} onRetry={listQuery.refetch} />
        ) : !listQuery.data || listQuery.data.items.length === 0 ? (
          <EmptyState
            icon={Siren}
            title={search || status || severity || monitorId ? 'No incidents match those filters' : 'No incidents recorded'}
            description={
              search || status || severity || monitorId
                ? 'Try clearing one or more filters.'
                : 'Incidents appear here only after a monitor crosses its consecutive-failure threshold.'
            }
            action={
              search || status || severity || monitorId ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearch('');
                    setStatus('');
                    setSeverity('');
                    setPage(1);
                  }}
                >
                  Clear filters
                </Button>
              ) : undefined
            }
          />
        ) : (
          <>
            <ul className="divide-y divide-slate-100">
              {listQuery.data.items.map((incident) => (
                <li key={incident.id}>
                  <Link href={`/incidents/detail?id=${incident.id}`} className="group flex flex-col gap-3 px-5 py-4 transition hover:bg-slate-50/80 sm:flex-row sm:items-center">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <SeverityBadge severity={incident.severity} />
                        <IncidentStatusBadge status={incident.status} />
                        <span className="text-[10px] text-slate-400">{formatRelative(incident.startedAt)}</span>
                      </div>
                      <p className="mt-2 text-sm font-semibold text-slate-900 group-hover:text-brand-700">{incident.title}</p>
                      <p className="mt-0.5 line-clamp-1 text-xs text-slate-500">{incident.description}</p>
                      <p className="mt-1 text-[11px] text-slate-400">{incident.monitorName} · {incident.monitorUrl}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-5 sm:flex-col sm:items-end sm:gap-1">
                      <div className="text-left sm:text-right">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">Duration</p>
                        <p className="text-xs font-semibold text-slate-700">{formatDuration(incident.durationSeconds)}</p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-slate-300 transition group-hover:text-brand-500" aria-hidden />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
            <Pagination pagination={listQuery.data.pagination} onPageChange={setPage} />
          </>
        )}
      </Card>
    </div>
  );
}

export default function IncidentsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <IncidentsContent />
    </Suspense>
  );
}
