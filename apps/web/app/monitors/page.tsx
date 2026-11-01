'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import type { Monitor, MonitorStatus, Paginated } from '@pulsewatch/shared';
import { Activity, ArrowRight, Plus, RefreshCw, Search, Server, TriangleAlert } from 'lucide-react';
import { useApiQuery, useDebouncedValue } from '@/lib/hooks';
import { formatMs, formatRelative, STATUS_META } from '@/lib/format';
import { api, ApiError } from '@/lib/api';
import { useToast } from '@/components/toast';
import { PageHeader, MonitoringNotice } from '@/components/ui/page';
import { Card } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/badge';
import { Button, buttonClasses } from '@/components/ui/button';
import { Select } from '@/components/ui/field';
import { Pagination } from '@/components/ui/pagination';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { PageSkeleton } from '@/components/loading';

const STATUS_OPTIONS = [
  { value: '', label: 'All states' },
  { value: 'OPERATIONAL', label: 'Operational' },
  { value: 'DEGRADED', label: 'Degraded' },
  { value: 'DOWN', label: 'Down' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'PAUSED', label: 'Paused' },
];

const PAGE_SIZE = 12;

export default function MonitorsPage() {
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [checkingId, setCheckingId] = useState<string | null>(null);
  const debouncedSearch = useDebouncedValue(search.trim(), 350);

  const path = useMemo(() => {
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(PAGE_SIZE),
    });
    if (debouncedSearch) params.set('search', debouncedSearch);
    if (status) params.set('status', status);
    return `/monitors?${params.toString()}`;
  }, [page, debouncedSearch, status]);

  const { data, error, loading, refetch } = useApiQuery<Paginated<Monitor>>(path, { pollMs: 30_000 });

  const handleCheck = async (monitor: Monitor) => {
    setCheckingId(monitor.id);
    try {
      await api.post(`/monitors/${monitor.id}/check`, undefined);
      toast.success('Check recorded', `${monitor.name} was checked just now.`);
      refetch();
    } catch (caught) {
      const message = caught instanceof ApiError ? caught.message : 'The check could not be completed.';
      toast.error('Check failed', message);
    } finally {
      setCheckingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Endpoints"
        title="Monitors"
        description="Every monitor is scoped to your account. Checks run from the scheduler and are recorded only when they complete."
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

      <MonitoringNotice text="Monitors are checked on their configured interval. If free hosting sleeps, overdue checks are queued after wake-up and the gap is preserved in history." />

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
            <input
              type="search"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Search by name or URL"
              aria-label="Search monitors"
              className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-900 shadow-sm transition placeholder:text-slate-400 hover:border-slate-300 focus:border-brand-400 focus:outline-none focus:ring-4 focus:ring-brand-500/10"
            />
          </div>
          <div className="sm:w-44">
            <Select
              label="Filter by state"
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                setPage(1);
              }}
              options={STATUS_OPTIONS}
              containerClassName="space-y-0"
            />
          </div>
        </div>

        {loading && !data ? (
          <div className="p-5">
            <PageSkeleton />
          </div>
        ) : error && !data ? (
          <ErrorState message={error.message} onRetry={refetch} />
        ) : !data || data.items.length === 0 ? (
          <EmptyState
            icon={Activity}
            title={search || status ? 'No monitors match those filters' : 'No monitors yet'}
            description={
              search || status
                ? 'Try a different search term or state filter.'
                : 'Register an endpoint to begin recording real availability observations.'
            }
            action={
              search || status ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearch('');
                    setStatus('');
                    setPage(1);
                  }}
                >
                  Clear filters
                </Button>
              ) : (
                <Link href="/monitors/new" className={buttonClasses('primary', 'sm')}>
                  <Plus className="h-3.5 w-3.5" aria-hidden />
                  Create monitor
                </Link>
              )
            }
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[780px] text-left">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">
                    <th className="px-5 py-3">Monitor</th>
                    <th className="px-5 py-3">State</th>
                    <th className="px-5 py-3">Last check</th>
                    <th className="px-5 py-3">Response</th>
                    <th className="px-5 py-3">Cadence</th>
                    <th className="px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.items.map((monitor) => (
                    <tr key={monitor.id} className="group transition hover:bg-slate-50/70">
                      <td className="px-5 py-4">
                        <div className="flex items-start gap-3">
                          <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${STATUS_META[monitor.currentStatus].dot}`} aria-hidden />
                          <div className="min-w-0">
                            <Link href={`/monitor?id=${monitor.id}`} className="block truncate text-sm font-semibold text-slate-900 hover:text-brand-700">
                              {monitor.name}
                            </Link>
                            <p className="mt-0.5 max-w-[320px] truncate text-xs text-slate-500">{monitor.targetUrl}</p>
                            {monitor.hasCustomHeaders ? (
                              <p className="mt-1 text-[10px] font-medium text-slate-400">
                                {monitor.headerNames.length} encrypted header{monitor.headerNames.length === 1 ? '' : 's'}
                              </p>
                            ) : null}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <StatusBadge status={monitor.currentStatus} />
                        {monitor.isStale ? (
                          <p className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-medium text-amber-700">
                            <TriangleAlert className="h-3 w-3" aria-hidden />
                            Stale
                          </p>
                        ) : null}
                      </td>
                      <td className="px-5 py-4 text-xs text-slate-600">
                        {monitor.lastCheckedAt ? formatRelative(monitor.lastCheckedAt) : 'Never checked'}
                        <p className="mt-0.5 text-[10px] text-slate-400">
                          Next {monitor.pausedAt ? 'paused' : formatRelative(monitor.nextCheckAt)}
                        </p>
                      </td>
                      <td className="px-5 py-4 text-xs font-medium text-slate-700">
                        {formatMs(monitor.latestCheck?.responseTimeMs)}
                        <p className="mt-0.5 text-[10px] font-normal text-slate-400">
                          {monitor.latestCheck
                            ? monitor.latestCheck.httpStatus
                              ? `HTTP ${monitor.latestCheck.httpStatus}`
                              : monitor.latestCheck.errorCode ?? 'No response'
                            : 'No observations'}
                        </p>
                      </td>
                      <td className="px-5 py-4 text-xs text-slate-600">
                        {monitor.intervalSeconds >= 3600
                          ? `${monitor.intervalSeconds / 3600}h`
                          : monitor.intervalSeconds >= 60
                            ? `${monitor.intervalSeconds / 60}m`
                            : `${monitor.intervalSeconds}s`}
                        <p className="mt-0.5 text-[10px] text-slate-400">{monitor.method}</p>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => void handleCheck(monitor)}
                            loading={checkingId === monitor.id}
                            disabled={Boolean(monitor.pausedAt) || checkingId !== null}
                          >
                            Check now
                          </Button>
                          <Link
                            href={`/monitor?id=${monitor.id}`}
                            className={buttonClasses('ghost', 'icon')}
                            aria-label={`Open ${monitor.name}`}
                          >
                            <ArrowRight className="h-4 w-4" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination pagination={data.pagination} onPageChange={setPage} />
          </>
        )}
      </Card>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-500">
        <span className="inline-flex items-center gap-1.5">
          <Server className="h-3.5 w-3.5" aria-hidden />
          {data ? `${data.pagination.total} monitor${data.pagination.total === 1 ? '' : 's'} in this workspace` : 'Loading workspace'}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <TriangleAlert className="h-3.5 w-3.5" aria-hidden />
          Stale means the expected observation is overdue, not that the endpoint is down.
        </span>
      </div>
    </div>
  );
}
