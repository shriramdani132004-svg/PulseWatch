export const MONITOR_METHODS = ['GET', 'HEAD', 'POST'] as const;
export type MonitorMethod = (typeof MONITOR_METHODS)[number];

export const MONITOR_STATUSES = [
  'PENDING',
  'OPERATIONAL',
  'DEGRADED',
  'DOWN',
  'PAUSED',
  'UNKNOWN',
] as const;
export type MonitorStatus = (typeof MONITOR_STATUSES)[number];

export const INCIDENT_SEVERITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
export type IncidentSeverity = (typeof INCIDENT_SEVERITIES)[number];

export const INCIDENT_STATUSES = ['OPEN', 'ACKNOWLEDGED', 'RESOLVED'] as const;
export type IncidentStatus = (typeof INCIDENT_STATUSES)[number];

export const INCIDENT_EVENT_TYPES = [
  'CREATED',
  'ACKNOWLEDGED',
  'RESOLVED',
  'CHECK_FAILED',
  'RECOVERY_DETECTED',
  'STATUS_CHANGED',
  'NOTE',
] as const;
export type IncidentEventType = (typeof INCIDENT_EVENT_TYPES)[number];

export const CHECK_SOURCES = ['SCHEDULED', 'MANUAL'] as const;
export type CheckSource = (typeof CHECK_SOURCES)[number];

export const REPORT_RANGES = ['24h', '7d', '30d'] as const;
export type ReportRange = (typeof REPORT_RANGES)[number];

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

export interface CheckResult {
  id: string;
  monitorId: string;
  checkedAt: string;
  successful: boolean;
  httpStatus: number | null;
  responseTimeMs: number | null;
  errorCode: string | null;
  sanitizedErrorMessage: string | null;
  source: CheckSource;
  redirectCount: number;
}

export interface Monitor {
  id: string;
  name: string;
  description: string | null;
  targetUrl: string;
  method: MonitorMethod;
  intervalSeconds: number;
  timeoutMs: number;
  expectedStatusMin: number;
  expectedStatusMax: number;
  failureThreshold: number;
  recoveryThreshold: number;
  degradedResponseTimeMs: number;
  consecutiveFailures: number;
  consecutiveSuccesses: number;
  currentStatus: MonitorStatus;
  lastCheckedAt: string | null;
  nextCheckAt: string | null;
  pausedAt: string | null;
  createdAt: string;
  updatedAt: string;
  hasCustomHeaders: boolean;
  headerNames: string[];
  isStale: boolean;
  latestCheck?: CheckResult | null;
}

export interface IncidentSummary {
  id: string;
  monitorId: string;
  monitorName: string;
  monitorUrl: string;
  title: string;
  description: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  startedAt: string;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
  durationSeconds: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface IncidentEvent {
  id: string;
  incidentId: string;
  eventType: IncidentEventType;
  description: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface IncidentDetail extends IncidentSummary {
  events: IncidentEvent[];
}

export interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface Paginated<T> {
  items: T[];
  pagination: Pagination;
}

export interface DashboardSummary {
  totalMonitors: number;
  operational: number;
  degraded: number;
  down: number;
  paused: number;
  pending: number;
  staleMonitors: number;
  openIncidents: number;
  observedUptimePercent: number | null;
  averageResponseTimeMs: number | null;
  totalObservedChecks: number;
  successfulChecks: number;
  failedChecks: number;
  monitoringCoveragePercent: number | null;
}

export interface SeriesPoint {
  bucket: string;
  total: number;
  successful: number;
  failed: number;
  uptimePercent: number | null;
  averageResponseTimeMs: number | null;
}

export interface StatusDistributionPoint {
  httpStatus: number | null;
  count: number;
}

export interface DashboardResponse {
  range: ReportRange;
  from: string;
  to: string;
  summary: DashboardSummary;
  series: SeriesPoint[];
  statusDistribution: StatusDistributionPoint[];
  monitors: Monitor[];
  recentIncidents: IncidentSummary[];
  recentChecks: Array<CheckResult & { monitorName: string; monitorUrl: string }>;
  monitoringNotice: string;
}

export interface MonitorReportRow {
  monitorId: string;
  name: string;
  targetUrl: string;
  currentStatus: MonitorStatus;
  intervalSeconds: number;
  observedChecks: number;
  successfulChecks: number;
  failedChecks: number;
  observedUptimePercent: number | null;
  averageResponseTimeMs: number | null;
  incidentCount: number;
  totalIncidentDurationSeconds: number;
  coveragePercent: number | null;
}

export interface ReportsOverviewResponse {
  range: ReportRange;
  from: string;
  to: string;
  summary: DashboardSummary;
  series: SeriesPoint[];
  statusDistribution: StatusDistributionPoint[];
  monitors: MonitorReportRow[];
  recurringFailures: MonitorReportRow[];
  incidents: {
    total: number;
    open: number;
    acknowledged: number;
    resolved: number;
    averageDurationSeconds: number | null;
    bySeverity: Record<string, number>;
  };
  monitoringNotice: string;
}

export interface MonitorStatsResponse {
  monitor: Monitor;
  range: ReportRange;
  from: string;
  to: string;
  summary: {
    observedChecks: number;
    successfulChecks: number;
    failedChecks: number;
    observedUptimePercent: number | null;
    averageResponseTimeMs: number | null;
    p95ResponseTimeMs: number | null;
    coveragePercent: number | null;
    incidentCount: number;
    openIncidentCount: number;
    totalIncidentDurationSeconds: number;
    monitoringGap: boolean;
  };
  series: SeriesPoint[];
  statusDistribution: StatusDistributionPoint[];
}

export interface ApiErrorBody {
  statusCode: number;
  error: string;
  message: string | string[];
  path: string;
  timestamp: string;
}

export const REPORT_RANGE_LABELS: Record<ReportRange, string> = {
  '24h': 'Last 24 hours',
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
};
