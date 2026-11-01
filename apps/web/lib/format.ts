import { format, formatDistanceToNowStrict } from 'date-fns';
import type {
  IncidentSeverity,
  IncidentStatus,
  MonitorStatus,
} from '@pulsewatch/shared';

export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '—';
  return format(date, 'MMM d, yyyy · HH:mm:ss');
}

export function formatShortDate(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '—';
  return format(date, 'MMM d, HH:mm');
}

export function formatRelative(value: string | Date | null | undefined): string {
  if (!value) return 'Never';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return 'Never';
  return `${formatDistanceToNowStrict(date, { addSuffix: true })}`;
}

export function formatMs(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  if (value < 1000) return `${Math.round(value)} ms`;
  return `${(value / 1000).toFixed(2)} s`;
}

export function formatPercent(value: number | null | undefined, digits = 2): string {
  if (value === null || value === undefined || Number.isNaN(value)) return 'No data';
  return `${value.toFixed(digits)}%`;
}

export function formatDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined) return 'Ongoing';
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ${Math.round(seconds % 60)}s`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ${minutes % 60}m`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h`;
}

export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return new Intl.NumberFormat('en-US').format(value);
}

export const STATUS_META: Record<
  MonitorStatus,
  { label: string; description: string; badge: string; dot: string; text: string }
> = {
  OPERATIONAL: {
    label: 'Operational',
    description: 'Checks are succeeding within expectations',
    badge: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
    dot: 'bg-emerald-500',
    text: 'text-emerald-700',
  },
  DEGRADED: {
    label: 'Degraded',
    description: 'Failures or slow responses are being observed',
    badge: 'bg-amber-50 text-amber-800 ring-amber-600/20',
    dot: 'bg-amber-500',
    text: 'text-amber-700',
  },
  DOWN: {
    label: 'Down',
    description: 'The failure threshold has been reached',
    badge: 'bg-rose-50 text-rose-700 ring-rose-600/20',
    dot: 'bg-rose-500',
    text: 'text-rose-700',
  },
  PAUSED: {
    label: 'Paused',
    description: 'Scheduled monitoring is paused',
    badge: 'bg-slate-100 text-slate-600 ring-slate-500/20',
    dot: 'bg-slate-400',
    text: 'text-slate-600',
  },
  PENDING: {
    label: 'Pending',
    description: 'Waiting for the first observation',
    badge: 'bg-sky-50 text-sky-700 ring-sky-600/20',
    dot: 'bg-sky-500',
    text: 'text-sky-700',
  },
  UNKNOWN: {
    label: 'Unknown',
    description: 'No reliable observation is available',
    badge: 'bg-slate-100 text-slate-600 ring-slate-500/20',
    dot: 'bg-slate-400',
    text: 'text-slate-600',
  },
};

export const INCIDENT_STATUS_META: Record<IncidentStatus, { label: string; badge: string }> = {
  OPEN: { label: 'Open', badge: 'bg-rose-50 text-rose-700 ring-rose-600/20' },
  ACKNOWLEDGED: { label: 'Acknowledged', badge: 'bg-amber-50 text-amber-800 ring-amber-600/20' },
  RESOLVED: { label: 'Resolved', badge: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20' },
};

export const SEVERITY_META: Record<IncidentSeverity, { label: string; badge: string; dot: string }> = {
  LOW: { label: 'Low', badge: 'bg-slate-100 text-slate-600 ring-slate-500/20', dot: 'bg-slate-400' },
  MEDIUM: { label: 'Medium', badge: 'bg-sky-50 text-sky-700 ring-sky-600/20', dot: 'bg-sky-500' },
  HIGH: { label: 'High', badge: 'bg-amber-50 text-amber-800 ring-amber-600/20', dot: 'bg-amber-500' },
  CRITICAL: { label: 'Critical', badge: 'bg-rose-50 text-rose-700 ring-rose-600/20', dot: 'bg-rose-500' },
};
