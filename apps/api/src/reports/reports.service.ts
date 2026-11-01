import { Injectable, NotFoundException } from '@nestjs/common';
import { Monitor, Prisma } from '@prisma/client';
import type {
  DashboardSummary,
  MonitorReportRow,
  ReportRange,
  SeriesPoint,
  StatusDistributionPoint,
} from '@pulsewatch/shared';
import { PrismaService } from '../prisma/prisma.service';
import { MonitorsService } from '../monitors/monitors.service';
import { IncidentsService } from '../incidents/incidents.service';
import type { MonitorListQueryDto } from '../monitors/dto/monitors.dto';
import type { IncidentListQueryDto } from '../incidents/dto/incidents.dto';

const RANGE_MS: Record<ReportRange, number> = {
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
};

const MONITORING_NOTICE =
  'PulseWatch reports only observed checks. Free hosting may sleep after inactivity; gaps are shown as missing observations, never as uptime.';

interface CheckAggregateRow {
  monitorId: string;
  successful: boolean;
  count: number;
  averageResponseTimeMs: number | null;
}

type GroupCountRow = { _count?: true | { _all?: number | null } | undefined };

function countAll(row: GroupCountRow): number {
  if (!row._count || row._count === true) return 0;
  return row._count._all ?? 0;
}

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly monitorsService: MonitorsService,
    private readonly incidentsService: IncidentsService,
  ) {}

  private bounds(range: ReportRange) {
    const to = new Date();
    const from = new Date(to.getTime() - RANGE_MS[range]);
    return { from, to };
  }

  private bucket(range: ReportRange): 'hour' | 'day' {
    return range === '24h' ? 'hour' : 'day';
  }

  private isStale(monitor: Pick<Monitor, 'pausedAt' | 'lastCheckedAt' | 'createdAt' | 'intervalSeconds'>, now: number) {
    if (monitor.pausedAt) return false;
    const reference = monitor.lastCheckedAt ?? monitor.createdAt;
    return now - reference.getTime() > Math.max(monitor.intervalSeconds * 3_000, 120_000);
  }

  private async getSummary(userId: string, from: Date, to: Date): Promise<DashboardSummary> {
    const monitors = await this.prisma.monitor.findMany({
      where: { userId },
      select: {
        id: true,
        currentStatus: true,
        intervalSeconds: true,
        lastCheckedAt: true,
        createdAt: true,
        pausedAt: true,
      },
    });

    const [aggregate, successful, openIncidents] = await this.prisma.$transaction([
      this.prisma.checkResult.aggregate({
        where: { monitor: { userId }, checkedAt: { gte: from, lte: to } },
        _count: { _all: true },
        _avg: { responseTimeMs: true },
      }),
      this.prisma.checkResult.count({
        where: { monitor: { userId }, checkedAt: { gte: from, lte: to }, successful: true },
      }),
      this.prisma.incident.count({
        where: { monitor: { userId }, status: { in: ['OPEN', 'ACKNOWLEDGED'] } },
      }),
    ]);

    const totalObserved = aggregate._count._all;
    const expected = monitors.reduce((sum, monitor) => {
      if (monitor.pausedAt) return sum;
      const start = Math.max(from.getTime(), monitor.createdAt.getTime());
      if (start >= to.getTime()) return sum;
      return sum + (to.getTime() - start) / 1000 / monitor.intervalSeconds;
    }, 0);
    const coverage = expected > 0 ? Math.min(100, (totalObserved / expected) * 100) : null;
    const now = Date.now();

    return {
      totalMonitors: monitors.length,
      operational: monitors.filter((monitor) => monitor.currentStatus === 'OPERATIONAL').length,
      degraded: monitors.filter((monitor) => monitor.currentStatus === 'DEGRADED').length,
      down: monitors.filter((monitor) => monitor.currentStatus === 'DOWN').length,
      paused: monitors.filter((monitor) => monitor.currentStatus === 'PAUSED').length,
      pending: monitors.filter(
        (monitor) => monitor.currentStatus === 'PENDING' || monitor.currentStatus === 'UNKNOWN',
      ).length,
      staleMonitors: monitors.filter((monitor) => this.isStale(monitor, now)).length,
      openIncidents,
      observedUptimePercent: totalObserved > 0 ? (successful / totalObserved) * 100 : null,
      averageResponseTimeMs: aggregate._avg.responseTimeMs,
      totalObservedChecks: totalObserved,
      successfulChecks: successful,
      failedChecks: totalObserved - successful,
      monitoringCoveragePercent: coverage,
    };
  }

  private async getSeries(
    userId: string,
    from: Date,
    to: Date,
    range: ReportRange,
    monitorId?: string,
  ): Promise<SeriesPoint[]> {
    const bucket = this.bucket(range);
    const monitorFilter = monitorId ? Prisma.sql`AND c."monitorId" = ${monitorId}::uuid` : Prisma.empty;
    const rows = await this.prisma.$queryRaw<
      Array<{ bucket: Date; total: number; successful: number; average: number | null }>
    >(Prisma.sql`
      SELECT date_trunc(${bucket}, c."checkedAt") AS bucket,
             COUNT(*)::int AS total,
             COUNT(*) FILTER (WHERE c."successful")::int AS successful,
             AVG(c."responseTimeMs")::float AS average
      FROM "CheckResult" c
      INNER JOIN "Monitor" m ON m."id" = c."monitorId"
      WHERE m."userId" = ${userId}::uuid
        AND c."checkedAt" >= ${from}
        AND c."checkedAt" <= ${to}
        ${monitorFilter}
      GROUP BY 1
      ORDER BY 1 ASC
    `);

    const byBucket = new Map(
      rows.map((row) => [
        row.bucket.toISOString(),
        {
          bucket: row.bucket.toISOString(),
          total: Number(row.total),
          successful: Number(row.successful),
          failed: Number(row.total) - Number(row.successful),
          uptimePercent: Number(row.total) > 0 ? (Number(row.successful) / Number(row.total)) * 100 : null,
          averageResponseTimeMs: row.average === null ? null : Number(row.average),
        } satisfies SeriesPoint,
      ]),
    );

    const series: SeriesPoint[] = [];
    const cursor = new Date(from);
    if (bucket === 'hour') {
      cursor.setUTCMinutes(0, 0, 0);
    } else {
      cursor.setUTCHours(0, 0, 0, 0);
    }
    while (cursor.getTime() <= to.getTime()) {
      const key = cursor.toISOString();
      series.push(
        byBucket.get(key) ?? {
          bucket: key,
          total: 0,
          successful: 0,
          failed: 0,
          uptimePercent: null,
          averageResponseTimeMs: null,
        },
      );
      cursor.setUTCHours(cursor.getUTCHours() + (bucket === 'hour' ? 1 : 24));
    }
    return series;
  }

  private async getStatusDistribution(userId: string, from: Date, monitorId?: string): Promise<StatusDistributionPoint[]> {
    const grouped = await this.prisma.checkResult.groupBy({
      by: ['httpStatus'],
      where: {
        monitor: { userId },
        checkedAt: { gte: from },
        ...(monitorId ? { monitorId } : {}),
      },
      _count: { _all: true },
      orderBy: { _count: { httpStatus: 'desc' } },
    });
    return grouped
      .map((row) => ({ httpStatus: row.httpStatus, count: countAll(row) }))
      .sort((a, b) => b.count - a.count);
  }

  private async getMonitorRows(
    userId: string,
    from: Date,
    to: Date,
  ): Promise<MonitorReportRow[]> {
    const monitors = await this.prisma.monitor.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
      take: 250,
    });
    if (monitors.length === 0) return [];
    const ids = monitors.map((monitor) => monitor.id);
    const [checkGroups, incidents] = await this.prisma.$transaction([
      this.prisma.checkResult.groupBy({
        by: ['monitorId', 'successful'],
        where: { monitorId: { in: ids }, checkedAt: { gte: from, lte: to } },
        _count: { _all: true },
        _avg: { responseTimeMs: true },
        orderBy: [{ monitorId: 'asc' }, { successful: 'asc' }],
      }),
      this.prisma.incident.findMany({
        where: { monitorId: { in: ids }, startedAt: { gte: from, lte: to } },
        select: { monitorId: true, startedAt: true, resolvedAt: true },
      }),
    ]);

    const checkMap = new Map<string, { observed: number; successful: number; average: number | null; avgCount: number }>();
    for (const group of checkGroups) {
      const count = countAll(group);
      const average = (group._avg as { responseTimeMs?: number | null } | undefined)?.responseTimeMs ?? null;
      const entry = checkMap.get(group.monitorId) ?? { observed: 0, successful: 0, average: null, avgCount: 0 };
      entry.observed += count;
      if (group.successful) entry.successful += count;
      if (average !== null) {
        entry.average = (entry.average ?? 0) + average * count;
        entry.avgCount += count;
      }
      checkMap.set(group.monitorId, entry);
    }

    const incidentMap = new Map<string, { count: number; duration: number }>();
    for (const incident of incidents) {
      const entry = incidentMap.get(incident.monitorId) ?? { count: 0, duration: 0 };
      entry.count += 1;
      if (incident.resolvedAt) {
        entry.duration += Math.max(0, (incident.resolvedAt.getTime() - incident.startedAt.getTime()) / 1000);
      }
      incidentMap.set(incident.monitorId, entry);
    }

    return monitors.map((monitor) => {
      const checks = checkMap.get(monitor.id);
      const incident = incidentMap.get(monitor.id);
      const observed = checks?.observed ?? 0;
      const successful = checks?.successful ?? 0;
      const expected = monitor.pausedAt
        ? null
        : Math.max(0, (to.getTime() - Math.max(from.getTime(), monitor.createdAt.getTime())) / 1000 / monitor.intervalSeconds);
      return {
        monitorId: monitor.id,
        name: monitor.name,
        targetUrl: monitor.targetUrl,
        currentStatus: monitor.currentStatus,
        intervalSeconds: monitor.intervalSeconds,
        observedChecks: observed,
        successfulChecks: successful,
        failedChecks: observed - successful,
        observedUptimePercent: observed > 0 ? (successful / observed) * 100 : null,
        averageResponseTimeMs:
          checks && checks.avgCount > 0 && checks.average !== null ? checks.average / checks.avgCount : null,
        incidentCount: incident?.count ?? 0,
        totalIncidentDurationSeconds: Math.round(incident?.duration ?? 0),
        coveragePercent: expected && expected > 0 ? Math.min(100, (observed / expected) * 100) : null,
      };
    });
  }

  private async getIncidentSummary(userId: string, from: Date) {
    const [byStatus, bySeverity, durationRows] = await this.prisma.$transaction([
      this.prisma.incident.groupBy({
        by: ['status'],
        where: { monitor: { userId }, startedAt: { gte: from } },
        _count: { _all: true },
        orderBy: { status: 'asc' },
      }),
      this.prisma.incident.groupBy({
        by: ['severity'],
        where: { monitor: { userId }, startedAt: { gte: from } },
        _count: { _all: true },
        orderBy: { severity: 'asc' },
      }),
      this.prisma.$queryRaw<Array<{ average: number | null }>>(Prisma.sql`
        SELECT AVG(EXTRACT(EPOCH FROM (i."resolvedAt" - i."startedAt")))::float AS average
        FROM "Incident" i
        INNER JOIN "Monitor" m ON m."id" = i."monitorId"
        WHERE m."userId" = ${userId}::uuid
          AND i."startedAt" >= ${from}
          AND i."status" = 'RESOLVED'::"IncidentStatus"
          AND i."resolvedAt" IS NOT NULL
      `),
    ]);
    const byStatusMap = Object.fromEntries(byStatus.map((row) => [row.status, countAll(row)]));
    return {
      total: byStatus.reduce((sum, row) => sum + countAll(row), 0),
      open: byStatusMap.OPEN ?? 0,
      acknowledged: byStatusMap.ACKNOWLEDGED ?? 0,
      resolved: byStatusMap.RESOLVED ?? 0,
      averageDurationSeconds:
        durationRows[0]?.average === null || durationRows[0]?.average === undefined
          ? null
          : Number(durationRows[0].average),
      bySeverity: Object.fromEntries(bySeverity.map((row) => [row.severity, countAll(row)])),
    };
  }

  async dashboard(userId: string, range: ReportRange) {
    const { from, to } = this.bounds(range);
    const [summary, series, statusDistribution, monitors, recentIncidents, recentChecks] =
      await Promise.all([
        this.getSummary(userId, from, to),
        this.getSeries(userId, from, to, range),
        this.getStatusDistribution(userId, from),
        this.monitorsService.list(userId, { page: 1, pageSize: 8 } as MonitorListQueryDto),
        this.incidentsService.list(userId, { page: 1, pageSize: 5 } as IncidentListQueryDto),
        this.prisma.checkResult.findMany({
          where: { monitor: { userId } },
          include: { monitor: { select: { name: true, targetUrl: true } } },
          orderBy: { checkedAt: 'desc' },
          take: 10,
        }),
      ]);

    return {
      range,
      from: from.toISOString(),
      to: to.toISOString(),
      summary,
      series,
      statusDistribution,
      monitors: monitors.items,
      recentIncidents: recentIncidents.items,
      recentChecks: recentChecks.map((check) => ({
        ...this.monitorsService.mapCheck(check),
        monitorName: check.monitor.name,
        monitorUrl: check.monitor.targetUrl,
      })),
      monitoringNotice: MONITORING_NOTICE,
    };
  }

  async overview(userId: string, range: ReportRange) {
    const { from, to } = this.bounds(range);
    const [summary, series, statusDistribution, monitors, incidents] = await Promise.all([
      this.getSummary(userId, from, to),
      this.getSeries(userId, from, to, range),
      this.getStatusDistribution(userId, from),
      this.getMonitorRows(userId, from, to),
      this.getIncidentSummary(userId, from),
    ]);
    return {
      range,
      from: from.toISOString(),
      to: to.toISOString(),
      summary,
      series,
      statusDistribution,
      monitors,
      recurringFailures: monitors
        .filter((monitor) => monitor.incidentCount >= 2)
        .sort((a, b) => b.incidentCount - a.incidentCount || b.failedChecks - a.failedChecks)
        .slice(0, 10),
      incidents,
      monitoringNotice: MONITORING_NOTICE,
    };
  }

  async monitorStats(userId: string, monitorId: string, range: ReportRange) {
    const monitor = await this.prisma.monitor.findFirst({ where: { id: monitorId, userId } });
    if (!monitor) {
      throw new NotFoundException('Monitor not found');
    }
    const { from, to } = this.bounds(range);
    const [aggregate, successful, series, statusDistribution, incidents, p95Rows] = await Promise.all([
      this.prisma.checkResult.aggregate({
        where: { monitorId, checkedAt: { gte: from, lte: to } },
        _count: { _all: true },
        _avg: { responseTimeMs: true },
      }),
      this.prisma.checkResult.count({
        where: { monitorId, checkedAt: { gte: from, lte: to }, successful: true },
      }),
      this.getSeries(userId, from, to, range, monitorId),
      this.getStatusDistribution(userId, from, monitorId),
      this.prisma.incident.findMany({
        where: { monitorId, startedAt: { gte: from, lte: to } },
        select: { status: true, startedAt: true, resolvedAt: true },
      }),
      this.prisma.$queryRaw<Array<{ p95: number | null }>>(Prisma.sql`
        SELECT percentile_cont(0.95) WITHIN GROUP (ORDER BY c."responseTimeMs")::float AS p95
        FROM "CheckResult" c
        WHERE c."monitorId" = ${monitorId}::uuid
          AND c."checkedAt" >= ${from}
          AND c."checkedAt" <= ${to}
          AND c."responseTimeMs" IS NOT NULL
      `),
    ]);

    const observed = aggregate._count._all;
    const expected = monitor.pausedAt
      ? null
      : Math.max(0, (to.getTime() - Math.max(from.getTime(), monitor.createdAt.getTime())) / 1000 / monitor.intervalSeconds);
    const coverage = expected && expected > 0 ? Math.min(100, (observed / expected) * 100) : null;
    const totalIncidentDuration = incidents.reduce(
      (sum, incident) =>
        sum + (incident.resolvedAt ? Math.max(0, (incident.resolvedAt.getTime() - incident.startedAt.getTime()) / 1000) : 0),
      0,
    );

    return {
      monitor: this.monitorsService.mapMonitor(monitor),
      range,
      from: from.toISOString(),
      to: to.toISOString(),
      summary: {
        observedChecks: observed,
        successfulChecks: successful,
        failedChecks: observed - successful,
        observedUptimePercent: observed > 0 ? (successful / observed) * 100 : null,
        averageResponseTimeMs: aggregate._avg.responseTimeMs,
        p95ResponseTimeMs: p95Rows[0]?.p95 === null || p95Rows[0]?.p95 === undefined ? null : Number(p95Rows[0].p95),
        coveragePercent: coverage,
        incidentCount: incidents.length,
        openIncidentCount: incidents.filter((incident) => incident.status !== 'RESOLVED').length,
        totalIncidentDurationSeconds: Math.round(totalIncidentDuration),
        monitoringGap: observed === 0 || (coverage !== null && coverage < 80),
      },
      series,
      statusDistribution,
    };
  }
}
