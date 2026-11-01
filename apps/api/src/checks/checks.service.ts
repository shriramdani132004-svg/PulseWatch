import {
  BadGatewayException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { CheckResult, Monitor, Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import type { MonitorStatus } from '@pulsewatch/shared';
import { PrismaService } from '../prisma/prisma.service';
import { EncryptionService, type CustomHeader } from '../common/crypto/encryption.service';
import { SafeHttpClient, type HttpCheckOutcome } from '../common/network/safe-http.client';
import { pagination, skipTake } from '../common/utils/pagination';
import type { CheckListQueryDto } from './dto/checks.dto';

const LEASE_MS = 120_000;

@Injectable()
export class ChecksService {
  private readonly logger = new Logger(ChecksService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
    private readonly safeHttp: SafeHttpClient,
  ) {}

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

  private async acquireLease(monitorId: string, requireDue: boolean): Promise<string | null> {
    const token = randomUUID();
    const now = new Date();
    const updated = await this.prisma.monitor.updateMany({
      where: {
        id: monitorId,
        pausedAt: null,
        ...(requireDue ? { nextCheckAt: { lte: now } } : {}),
        OR: [{ leaseExpiresAt: null }, { leaseExpiresAt: { lt: now } }],
      },
      data: {
        leaseOwner: token,
        leaseExpiresAt: new Date(now.getTime() + LEASE_MS),
      },
    });
    return updated.count === 1 ? token : null;
  }

  private async clearLease(monitorId: string, token: string): Promise<void> {
    await this.prisma.monitor
      .updateMany({
        where: { id: monitorId, leaseOwner: token },
        data: { leaseOwner: null, leaseExpiresAt: null },
      })
      .catch(() => undefined);
  }

  async runScheduledCheck(monitorId: string): Promise<{ skipped: boolean; check?: ReturnType<ChecksService['mapCheck']> }> {
    const token = await this.acquireLease(monitorId, true);
    if (!token) {
      return { skipped: true };
    }

    let monitor: Monitor | null = null;
    try {
      monitor = await this.prisma.monitor.findUnique({ where: { id: monitorId } });
      if (!monitor || monitor.pausedAt) {
        await this.clearLease(monitorId, token);
        return { skipped: true };
      }
      const outcome = await this.executeCheck(monitor);
      const result = await this.recordOutcome(monitor, token, outcome, 'SCHEDULED');
      if (result.skipped) {
        return { skipped: true };
      }
      return { skipped: false, check: this.mapCheck(result.check as CheckResult) };
    } catch (error) {
      await this.clearLease(monitorId, token);
      this.logger.error(
        `Scheduled check failed for monitor ${monitorId}: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
      throw error;
    }
  }

  async manualCheck(userId: string, monitorId: string) {
    const monitor = await this.prisma.monitor.findFirst({ where: { id: monitorId, userId } });
    if (!monitor) {
      throw new NotFoundException('Monitor not found');
    }
    if (monitor.pausedAt) {
      throw new ConflictException('Resume the monitor before running a check');
    }

    const token = await this.acquireLease(monitor.id, false);
    if (!token) {
      throw new ConflictException('A check is already in progress for this monitor');
    }

    try {
      const current = await this.prisma.monitor.findUniqueOrThrow({ where: { id: monitor.id } });
      const outcome = await this.executeCheck(current);
      const result = await this.recordOutcome(current, token, outcome, 'MANUAL');
      if (result.skipped) {
        throw new ConflictException('The monitor was paused while the check was running');
      }
      return {
        check: this.mapCheck(result.check as CheckResult),
        monitor: {
          id: result.monitor.id,
          currentStatus: result.monitor.currentStatus as MonitorStatus,
          consecutiveFailures: result.monitor.consecutiveFailures,
          consecutiveSuccesses: result.monitor.consecutiveSuccesses,
          lastCheckedAt: result.monitor.lastCheckedAt?.toISOString() ?? null,
          nextCheckAt: result.monitor.nextCheckAt?.toISOString() ?? null,
        },
      };
    } catch (error) {
      await this.clearLease(monitor.id, token);
      if (error instanceof ConflictException) {
        throw error;
      }
      this.logger.error(
        `Manual check failed for monitor ${monitor.id}: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
      throw new BadGatewayException('The check could not be completed');
    }
  }

  private async executeCheck(monitor: Monitor): Promise<HttpCheckOutcome> {
    let headers: CustomHeader[] = [];
    try {
      headers = this.encryption.decryptHeaders(monitor.encryptedHeaders);
    } catch {
      return {
        successful: false,
        httpStatus: null,
        responseTimeMs: null,
        errorCode: 'HEADER_ERROR',
        sanitizedErrorMessage: 'Stored custom headers could not be decrypted',
        redirectCount: 0,
      };
    }
    return this.safeHttp.perform({
      url: monitor.targetUrl,
      method: monitor.method,
      timeoutMs: monitor.timeoutMs,
      headers,
      expectedStatusMin: monitor.expectedStatusMin,
      expectedStatusMax: monitor.expectedStatusMax,
    });
  }

  private async recordOutcome(
    monitor: Monitor,
    leaseToken: string,
    outcome: HttpCheckOutcome,
    source: 'SCHEDULED' | 'MANUAL',
  ) {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.monitor.findFirst({
        where: { id: monitor.id, leaseOwner: leaseToken },
      });
      if (!current) {
        return { skipped: true as const };
      }
      if (current.pausedAt) {
        await tx.monitor.update({
          where: { id: current.id },
          data: { leaseOwner: null, leaseExpiresAt: null },
        });
        return { skipped: true as const };
      }

      const checkedAt = new Date();
      const check = await tx.checkResult.create({
        data: {
          monitorId: current.id,
          checkedAt,
          successful: outcome.successful,
          httpStatus: outcome.httpStatus,
          responseTimeMs: outcome.responseTimeMs,
          errorCode: outcome.errorCode,
          sanitizedErrorMessage: outcome.sanitizedErrorMessage?.slice(0, 500) ?? null,
          source,
          redirectCount: outcome.redirectCount,
        },
      });

      const openIncident = await tx.incident.findFirst({
        where: { monitorId: current.id, status: { in: ['OPEN', 'ACKNOWLEDGED'] } },
        orderBy: { startedAt: 'desc' },
      });

      let currentStatus: MonitorStatus;
      let consecutiveFailures = current.consecutiveFailures;
      let consecutiveSuccesses = current.consecutiveSuccesses;
      let incidentToReturn = openIncident;

      if (outcome.successful) {
        consecutiveFailures = 0;
        consecutiveSuccesses = current.consecutiveSuccesses + 1;
        const slow = (outcome.responseTimeMs ?? 0) >= current.degradedResponseTimeMs;

        if (openIncident) {
          if (consecutiveSuccesses >= current.recoveryThreshold) {
            const resolved = await tx.incident.update({
              where: { id: openIncident.id },
              data: { status: 'RESOLVED', resolvedAt: checkedAt },
            });
            await tx.incidentEvent.create({
              data: {
                incidentId: openIncident.id,
                eventType: 'RESOLVED',
                description: `Monitor recovered after ${consecutiveSuccesses} consecutive successful check(s).`,
                metadata: {
                  checkId: check.id,
                  httpStatus: outcome.httpStatus,
                  responseTimeMs: outcome.responseTimeMs,
                },
              },
            });
            incidentToReturn = resolved;
            currentStatus = slow ? 'DEGRADED' : 'OPERATIONAL';
          } else {
            await tx.incidentEvent.create({
              data: {
                incidentId: openIncident.id,
                eventType: 'RECOVERY_DETECTED',
                description: `Recovery check ${consecutiveSuccesses}/${current.recoveryThreshold} succeeded; incident remains open until the recovery threshold is met.`,
                metadata: { checkId: check.id },
              },
            });
            currentStatus = 'DEGRADED';
          }
        } else {
          currentStatus = slow ? 'DEGRADED' : 'OPERATIONAL';
        }
      } else {
        consecutiveSuccesses = 0;
        consecutiveFailures = current.consecutiveFailures + 1;

        if (consecutiveFailures >= current.failureThreshold) {
          currentStatus = 'DOWN';
          const severity = consecutiveFailures >= current.failureThreshold * 2 ? 'CRITICAL' : 'HIGH';
          if (openIncident) {
            const updated = await tx.incident.update({
              where: { id: openIncident.id },
              data: {
                description: outcome.sanitizedErrorMessage ?? openIncident.description,
                severity,
              },
            });
            await tx.incidentEvent.create({
              data: {
                incidentId: openIncident.id,
                eventType: 'CHECK_FAILED',
                description: `Check failed again (${consecutiveFailures} consecutive failures): ${
                  outcome.sanitizedErrorMessage ?? 'unknown failure'
                }`,
                metadata: {
                  checkId: check.id,
                  httpStatus: outcome.httpStatus,
                  errorCode: outcome.errorCode,
                  consecutiveFailures,
                },
              },
            });
            incidentToReturn = updated;
          } else {
            const incident = await tx.incident.create({
              data: {
                monitorId: current.id,
                title: `${current.name} is down`,
                description: outcome.sanitizedErrorMessage ?? 'The monitor failed its health checks.',
                severity,
                status: 'OPEN',
                startedAt: checkedAt,
              },
            });
            await tx.incidentEvent.create({
              data: {
                incidentId: incident.id,
                eventType: 'CREATED',
                description: `Incident opened after ${consecutiveFailures} consecutive failed checks (threshold ${current.failureThreshold}).`,
                metadata: {
                  checkId: check.id,
                  httpStatus: outcome.httpStatus,
                  errorCode: outcome.errorCode,
                },
              },
            });
            incidentToReturn = incident;
          }
        } else {
          currentStatus = 'DEGRADED';
          if (openIncident) {
            await tx.incidentEvent.create({
              data: {
                incidentId: openIncident.id,
                eventType: 'CHECK_FAILED',
                description: `Check failed (${consecutiveFailures}/${current.failureThreshold} toward the incident threshold).`,
                metadata: { checkId: check.id, errorCode: outcome.errorCode },
              },
            });
          }
        }
      }

      const nextCheckAt =
        source === 'MANUAL' && current.nextCheckAt.getTime() > checkedAt.getTime()
          ? current.nextCheckAt
          : new Date(checkedAt.getTime() + current.intervalSeconds * 1_000);

      const updatedMonitor = await tx.monitor.update({
        where: { id: current.id },
        data: {
          currentStatus,
          consecutiveFailures,
          consecutiveSuccesses,
          lastCheckedAt: checkedAt,
          nextCheckAt,
          leaseOwner: null,
          leaseExpiresAt: null,
        },
      });

      return { skipped: false as const, check, monitor: updatedMonitor, incident: incidentToReturn };
    });
  }

  async listChecks(userId: string, monitorId: string, query: CheckListQueryDto) {
    const monitor = await this.prisma.monitor.findFirst({
      where: { id: monitorId, userId },
      select: { id: true },
    });
    if (!monitor) {
      throw new NotFoundException('Monitor not found');
    }
    const { skip, take } = skipTake(query.page, query.pageSize);
    const where: Prisma.CheckResultWhereInput = {
      monitorId,
      ...(query.successful !== undefined ? { successful: query.successful } : {}),
    };
    const [total, checks] = await this.prisma.$transaction([
      this.prisma.checkResult.count({ where }),
      this.prisma.checkResult.findMany({
        where,
        orderBy: { checkedAt: 'desc' },
        skip,
        take,
      }),
    ]);
    return {
      items: checks.map((check) => this.mapCheck(check)),
      pagination: pagination(query.page, query.pageSize, total),
    };
  }
}
