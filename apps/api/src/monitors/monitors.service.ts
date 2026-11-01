import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CheckResult, Monitor } from '@prisma/client';
import type { MonitorStatus } from '@pulsewatch/shared';
import { PrismaService } from '../prisma/prisma.service';
import { EncryptionService, type CustomHeader } from '../common/crypto/encryption.service';
import { UrlSafetyService } from '../common/network/url-safety.service';
import { validateCustomHeaders } from '../common/network/header-validation';
import { pagination, skipTake } from '../common/utils/pagination';
import { CreateMonitorDto, MonitorListQueryDto, UpdateMonitorDto } from './dto/monitors.dto';

@Injectable()
export class MonitorsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
    private readonly urlSafety: UrlSafetyService,
  ) {}

  private ensureStatusRange(min: number, max: number): void {
    if (max < min) {
      throw new BadRequestException('expectedStatusMax must be greater than or equal to expectedStatusMin');
    }
  }

  private headerNames(encrypted: string | null): string[] {
    if (!encrypted) return [];
    try {
      return this.encryption.headerNames(encrypted);
    } catch {
      return [];
    }
  }

  private isStale(monitor: Monitor, now = Date.now()): boolean {
    if (monitor.pausedAt) return false;
    if (!monitor.lastCheckedAt) {
      return now - monitor.createdAt.getTime() > Math.max(monitor.intervalSeconds * 3_000, 120_000);
    }
    return now - monitor.lastCheckedAt.getTime() > Math.max(monitor.intervalSeconds * 3_000, 120_000);
  }

  mapMonitor(monitor: Monitor, latestCheck?: CheckResult | null) {
    return {
      id: monitor.id,
      name: monitor.name,
      description: monitor.description,
      targetUrl: monitor.targetUrl,
      method: monitor.method,
      intervalSeconds: monitor.intervalSeconds,
      timeoutMs: monitor.timeoutMs,
      expectedStatusMin: monitor.expectedStatusMin,
      expectedStatusMax: monitor.expectedStatusMax,
      failureThreshold: monitor.failureThreshold,
      recoveryThreshold: monitor.recoveryThreshold,
      degradedResponseTimeMs: monitor.degradedResponseTimeMs,
      consecutiveFailures: monitor.consecutiveFailures,
      consecutiveSuccesses: monitor.consecutiveSuccesses,
      currentStatus: monitor.currentStatus as MonitorStatus,
      lastCheckedAt: monitor.lastCheckedAt?.toISOString() ?? null,
      nextCheckAt: monitor.nextCheckAt?.toISOString() ?? null,
      pausedAt: monitor.pausedAt?.toISOString() ?? null,
      createdAt: monitor.createdAt.toISOString(),
      updatedAt: monitor.updatedAt.toISOString(),
      hasCustomHeaders: Boolean(monitor.encryptedHeaders),
      headerNames: this.headerNames(monitor.encryptedHeaders),
      isStale: this.isStale(monitor),
      latestCheck: latestCheck ? this.mapCheck(latestCheck) : null,
    };
  }

  mapCheck(check: CheckResult) {
    return {
      id: check.id,
      monitorId: check.monitorId,
      checkedAt: check.checkedAt.toISOString(),
      successful: check.successful,
      httpStatus: check.httpStatus,
      responseTimeMs: check.responseTimeMs,
      errorCode: check.errorCode,
      sanitizedErrorMessage: check.sanitizedErrorMessage,
      source: check.source,
      redirectCount: check.redirectCount,
    };
  }

  private async latestChecks(monitorIds: string[]): Promise<Map<string, CheckResult>> {
    if (monitorIds.length === 0) return new Map();
    const checks = await this.prisma.checkResult.findMany({
      where: { monitorId: { in: monitorIds } },
      orderBy: [{ monitorId: 'asc' }, { checkedAt: 'desc' }],
      distinct: ['monitorId'],
    });
    return new Map(checks.map((check) => [check.monitorId, check]));
  }

  async list(userId: string, query: MonitorListQueryDto) {
    const { skip, take } = skipTake(query.page, query.pageSize);
    const where = {
      userId,
      ...(query.status ? { currentStatus: query.status } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' as const } },
              { targetUrl: { contains: query.search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };
    const [total, monitors] = await this.prisma.$transaction([
      this.prisma.monitor.count({ where }),
      this.prisma.monitor.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }],
        skip,
        take,
      }),
    ]);
    const latest = await this.latestChecks(monitors.map((monitor) => monitor.id));
    return {
      items: monitors.map((monitor) => this.mapMonitor(monitor, latest.get(monitor.id))),
      pagination: pagination(query.page, query.pageSize, total),
    };
  }

  async findOwned(userId: string, id: string): Promise<Monitor> {
    const monitor = await this.prisma.monitor.findFirst({ where: { id, userId } });
    if (!monitor) {
      throw new NotFoundException('Monitor not found');
    }
    return monitor;
  }

  async get(userId: string, id: string) {
    const monitor = await this.findOwned(userId, id);
    const latestCheck = await this.prisma.checkResult.findFirst({
      where: { monitorId: monitor.id },
      orderBy: { checkedAt: 'desc' },
    });
    return this.mapMonitor(monitor, latestCheck);
  }

  async create(userId: string, dto: CreateMonitorDto) {
    this.ensureStatusRange(dto.expectedStatusMin, dto.expectedStatusMax);
    const target = await this.urlSafety.validateUrlOrThrow(dto.targetUrl);
    const customHeaders = dto.customHeaders ? validateCustomHeaders(dto.customHeaders as CustomHeader[]) : [];
    const encryptedHeaders = customHeaders.length > 0 ? this.encryption.encryptHeaders(customHeaders) : null;
    const monitor = await this.prisma.monitor.create({
      data: {
        userId,
        name: dto.name.trim(),
        description: dto.description?.trim() || null,
        targetUrl: target.url.toString(),
        method: dto.method,
        intervalSeconds: dto.intervalSeconds,
        timeoutMs: dto.timeoutMs,
        expectedStatusMin: dto.expectedStatusMin,
        expectedStatusMax: dto.expectedStatusMax,
        failureThreshold: dto.failureThreshold,
        recoveryThreshold: dto.recoveryThreshold,
        degradedResponseTimeMs: dto.degradedResponseTimeMs,
        encryptedHeaders,
        currentStatus: 'PENDING',
        nextCheckAt: new Date(),
      },
    });
    return this.mapMonitor(monitor);
  }

  async update(userId: string, id: string, dto: UpdateMonitorDto) {
    const existing = await this.findOwned(userId, id);
    const min = dto.expectedStatusMin ?? existing.expectedStatusMin;
    const max = dto.expectedStatusMax ?? existing.expectedStatusMax;
    this.ensureStatusRange(min, max);

    let targetUrl = existing.targetUrl;
    if (dto.targetUrl !== undefined) {
      const target = await this.urlSafety.validateUrlOrThrow(dto.targetUrl);
      targetUrl = target.url.toString();
    }

    let encryptedHeaders = existing.encryptedHeaders;
    if (dto.clearCustomHeaders) {
      encryptedHeaders = null;
    } else if (dto.customHeaders !== undefined) {
      const validated = validateCustomHeaders(dto.customHeaders as CustomHeader[]);
      encryptedHeaders = validated.length > 0 ? this.encryption.encryptHeaders(validated) : null;
    }

    const monitor = await this.prisma.monitor.update({
      where: { id: existing.id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.description !== undefined ? { description: dto.description?.trim() || null } : {}),
        ...(dto.targetUrl !== undefined ? { targetUrl } : {}),
        ...(dto.method !== undefined ? { method: dto.method } : {}),
        ...(dto.intervalSeconds !== undefined ? { intervalSeconds: dto.intervalSeconds } : {}),
        ...(dto.timeoutMs !== undefined ? { timeoutMs: dto.timeoutMs } : {}),
        ...(dto.expectedStatusMin !== undefined ? { expectedStatusMin: dto.expectedStatusMin } : {}),
        ...(dto.expectedStatusMax !== undefined ? { expectedStatusMax: dto.expectedStatusMax } : {}),
        ...(dto.failureThreshold !== undefined ? { failureThreshold: dto.failureThreshold } : {}),
        ...(dto.recoveryThreshold !== undefined ? { recoveryThreshold: dto.recoveryThreshold } : {}),
        ...(dto.degradedResponseTimeMs !== undefined
          ? { degradedResponseTimeMs: dto.degradedResponseTimeMs }
          : {}),
        encryptedHeaders,
      },
    });
    return this.mapMonitor(monitor);
  }

  async remove(userId: string, id: string) {
    const monitor = await this.findOwned(userId, id);
    await this.prisma.monitor.delete({ where: { id: monitor.id } });
    return { message: 'Monitor deleted' };
  }

  async pause(userId: string, id: string) {
    const monitor = await this.findOwned(userId, id);
    const updated = await this.prisma.monitor.update({
      where: { id: monitor.id },
      data: {
        currentStatus: 'PAUSED',
        pausedAt: new Date(),
        leaseOwner: null,
        leaseExpiresAt: null,
      },
    });
    return this.mapMonitor(updated);
  }

  async resume(userId: string, id: string) {
    const monitor = await this.findOwned(userId, id);
    const updated = await this.prisma.monitor.update({
      where: { id: monitor.id },
      data: {
        currentStatus: 'PENDING',
        pausedAt: null,
        nextCheckAt: new Date(),
        consecutiveFailures: 0,
        consecutiveSuccesses: 0,
        leaseOwner: null,
        leaseExpiresAt: null,
      },
    });
    return this.mapMonitor(updated);
  }
}
