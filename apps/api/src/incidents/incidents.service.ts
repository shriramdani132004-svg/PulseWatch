import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Incident, IncidentEvent, Monitor, Prisma } from '@prisma/client';
import type { IncidentSeverity, IncidentStatus } from '@pulsewatch/shared';
import { PrismaService } from '../prisma/prisma.service';
import { pagination, skipTake } from '../common/utils/pagination';
import { IncidentListQueryDto } from './dto/incidents.dto';

type GroupCountRow = { _count?: true | { _all?: number | null } | undefined };

function countAll(row: GroupCountRow): number {
  if (!row._count || row._count === true) return 0;
  return row._count._all ?? 0;
}
type IncidentWithMonitor = Incident & { monitor: Pick<Monitor, 'id' | 'name' | 'targetUrl'> };
type IncidentWithEvents = IncidentWithMonitor & { events: IncidentEvent[] };

@Injectable()
export class IncidentsService {
  constructor(private readonly prisma: PrismaService) {}

  mapIncident(incident: IncidentWithMonitor) {
    return {
      id: incident.id,
      monitorId: incident.monitorId,
      monitorName: incident.monitor.name,
      monitorUrl: incident.monitor.targetUrl,
      title: incident.title,
      description: incident.description,
      severity: incident.severity as IncidentSeverity,
      status: incident.status as IncidentStatus,
      startedAt: incident.startedAt.toISOString(),
      acknowledgedAt: incident.acknowledgedAt?.toISOString() ?? null,
      resolvedAt: incident.resolvedAt?.toISOString() ?? null,
      durationSeconds: incident.resolvedAt
        ? Math.max(0, Math.round((incident.resolvedAt.getTime() - incident.startedAt.getTime()) / 1000))
        : null,
      createdAt: incident.createdAt.toISOString(),
      updatedAt: incident.updatedAt.toISOString(),
    };
  }

  private mapEvent(event: IncidentEvent) {
    return {
      id: event.id,
      incidentId: event.incidentId,
      eventType: event.eventType,
      description: event.description,
      metadata: (event.metadata as Record<string, unknown> | null) ?? null,
      createdAt: event.createdAt.toISOString(),
    };
  }

  async list(userId: string, query: IncidentListQueryDto) {
    const { skip, take } = skipTake(query.page, query.pageSize);
    const where: Prisma.IncidentWhereInput = {
      monitor: { userId },
      ...(query.status ? { status: query.status } : {}),
      ...(query.severity ? { severity: query.severity } : {}),
      ...(query.monitorId ? { monitorId: query.monitorId } : {}),
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search, mode: 'insensitive' } },
              { description: { contains: query.search, mode: 'insensitive' } },
              { monitor: { name: { contains: query.search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };
    const [total, incidents] = await this.prisma.$transaction([
      this.prisma.incident.count({ where }),
      this.prisma.incident.findMany({
        where,
        include: { monitor: { select: { id: true, name: true, targetUrl: true } } },
        orderBy: [{ status: 'asc' }, { startedAt: 'desc' }],
        skip,
        take,
      }),
    ]);
    return {
      items: incidents.map((incident) => this.mapIncident(incident)),
      pagination: pagination(query.page, query.pageSize, total),
    };
  }

  async get(userId: string, id: string) {
    const incident = await this.prisma.incident.findFirst({
      where: { id, monitor: { userId } },
      include: {
        monitor: { select: { id: true, name: true, targetUrl: true } },
        events: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!incident) {
      throw new NotFoundException('Incident not found');
    }
    return {
      ...this.mapIncident(incident as IncidentWithEvents),
      events: (incident as IncidentWithEvents).events.map((event) => this.mapEvent(event)),
    };
  }

  async acknowledge(userId: string, id: string) {
    const incident = await this.prisma.incident.findFirst({
      where: { id, monitor: { userId } },
      include: { monitor: { select: { id: true, name: true, targetUrl: true } } },
    });
    if (!incident) {
      throw new NotFoundException('Incident not found');
    }
    if (incident.status === 'RESOLVED') {
      throw new ConflictException('Resolved incidents cannot be acknowledged');
    }
    if (incident.status === 'ACKNOWLEDGED') {
      return this.mapIncident(incident);
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      const acknowledgedAt = new Date();
      const result = await tx.incident.update({
        where: { id: incident.id },
        data: { status: 'ACKNOWLEDGED', acknowledgedAt },
        include: { monitor: { select: { id: true, name: true, targetUrl: true } } },
      });
      await tx.incidentEvent.create({
        data: {
          incidentId: incident.id,
          eventType: 'ACKNOWLEDGED',
          description: 'Incident acknowledged by the account owner.',
          metadata: { acknowledgedAt: acknowledgedAt.toISOString() },
        },
      });
      return result;
    });
    return this.mapIncident(updated);
  }

  async resolve(userId: string, id: string) {
    const incident = await this.prisma.incident.findFirst({
      where: { id, monitor: { userId } },
      include: { monitor: { select: { id: true, name: true, targetUrl: true } } },
    });
    if (!incident) {
      throw new NotFoundException('Incident not found');
    }
    if (incident.status === 'RESOLVED') {
      return this.mapIncident(incident);
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      const resolvedAt = new Date();
      const result = await tx.incident.update({
        where: { id: incident.id },
        data: { status: 'RESOLVED', resolvedAt },
        include: { monitor: { select: { id: true, name: true, targetUrl: true } } },
      });
      await tx.incidentEvent.create({
        data: {
          incidentId: incident.id,
          eventType: 'RESOLVED',
          description: 'Incident manually resolved by the account owner.',
          metadata: { resolvedAt: resolvedAt.toISOString() },
        },
      });
      return result;
    });
    return this.mapIncident(updated);
  }

  async summary(userId: string) {
    const [byStatus, bySeverity, open] = await this.prisma.$transaction([
      this.prisma.incident.groupBy({
        by: ['status'],
        where: { monitor: { userId } },
        _count: { _all: true },
        orderBy: { status: 'asc' },
      }),
      this.prisma.incident.groupBy({
        by: ['severity'],
        where: { monitor: { userId } },
        _count: { _all: true },
        orderBy: { severity: 'asc' },
      }),
      this.prisma.incident.count({
        where: { monitor: { userId }, status: { in: ['OPEN', 'ACKNOWLEDGED'] } },
      }),
    ]);
    return {
      open,
      byStatus: Object.fromEntries(byStatus.map((row) => [row.status, countAll(row)])),
      bySeverity: Object.fromEntries(bySeverity.map((row) => [row.severity, countAll(row)])),
    };
  }
}
