'use client';

import type { ReactNode } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { SeriesPoint, StatusDistributionPoint } from '@pulsewatch/shared';
import { formatMs, formatPercent, formatShortDate } from '@/lib/format';
import { EmptyState } from '@/components/ui/states';

const TOOLTIP_STYLE = {
  borderRadius: 12,
  border: '1px solid #e2e8f0',
  boxShadow: '0 12px 30px -18px rgba(15, 23, 42, 0.35)',
  fontSize: 12,
  padding: '8px 12px',
};

function hasObservedData(series: SeriesPoint[]): boolean {
  return series.some((point) => point.total > 0);
}

export function AvailabilityChart({ series, height = 260 }: { series: SeriesPoint[]; height?: number }) {
  if (!hasObservedData(series)) {
    return (
      <EmptyState
        title="No observed checks in this window"
        description="Availability is not inferred from missing data. Run a check or wait for the scheduler to collect observations."
        className="py-10"
      />
    );
  }
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={series} margin={{ top: 10, right: 12, left: -18, bottom: 0 }}>
          <defs>
            <linearGradient id="availabilityFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity={0.22} />
              <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" vertical={false} />
          <XAxis
            dataKey="bucket"
            tickFormatter={(value: string) => formatShortDate(value)}
            tickLine={false}
            axisLine={false}
            minTickGap={28}
          />
          <YAxis domain={[0, 100]} tickFormatter={(value: number) => `${value}%`} tickLine={false} axisLine={false} />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            labelFormatter={(value) => formatShortDate(String(value))}
            formatter={(value: unknown, _name: unknown, item: unknown) => {
              const point = (item as { payload?: SeriesPoint } | undefined)?.payload;
              return [
                point ? `${formatPercent(point.uptimePercent)} (${point.successful}/${point.total} checks)` : formatPercent(Number(value)),
                'Observed uptime',
              ];
            }}
          />
          <Area
            type="monotone"
            dataKey="uptimePercent"
            stroke="#059669"
            strokeWidth={2}
            fill="url(#availabilityFill)"
            connectNulls={false}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 2, fill: '#fff' }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ResponseTimeChart({ series, height = 260 }: { series: SeriesPoint[]; height?: number }) {
  if (!hasObservedData(series)) {
    return (
      <EmptyState
        title="No latency observations yet"
        description="Response time appears after the API records real checks against your endpoint."
        className="py-10"
      />
    );
  }
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={series} margin={{ top: 10, right: 12, left: -18, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" vertical={false} />
          <XAxis
            dataKey="bucket"
            tickFormatter={(value: string) => formatShortDate(value)}
            tickLine={false}
            axisLine={false}
            minTickGap={28}
          />
          <YAxis tickFormatter={(value: number) => `${value}ms`} tickLine={false} axisLine={false} />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            labelFormatter={(value) => formatShortDate(String(value))}
            formatter={(value: unknown) => [formatMs(Number(value)), 'Average response']}
          />
          <Line
            type="monotone"
            dataKey="averageResponseTimeMs"
            stroke="#4f46e5"
            strokeWidth={2}
            dot={false}
            connectNulls={false}
            activeDot={{ r: 4, strokeWidth: 2, fill: '#fff' }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function StatusDistributionChart({ data }: { data: StatusDistributionPoint[] }) {
  if (data.length === 0) {
    return (
      <EmptyState
        title="No HTTP status observations"
        description="Status code distribution is calculated from persisted check results only."
        className="py-10"
      />
    );
  }
  const palette = ['#4f46e5', '#0d9488', '#f59e0b', '#e11d48', '#64748b', '#0ea5e9'];
  const rows = data.slice(0, 8).map((row, index) => ({
    label: row.httpStatus === null ? 'Network error' : `HTTP ${row.httpStatus}`,
    count: row.count,
    fill: palette[index % palette.length],
  }));
  return (
    <div style={{ height: 280 }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 24, left: 14, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" horizontal={false} />
          <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} />
          <YAxis type="category" dataKey="label" width={92} tickLine={false} axisLine={false} />
          <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(value: unknown) => [`${value ?? 0} checks`, 'Observed']} />
          <Bar dataKey="count" radius={[0, 6, 6, 0]} barSize={18}>
            {rows.map((row) => (
              <Cell key={row.label} fill={row.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ChartCard({
  title,
  description,
  children,
  actions,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-soft">
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
          {description ? <p className="mt-0.5 text-xs text-slate-500">{description}</p> : null}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}
