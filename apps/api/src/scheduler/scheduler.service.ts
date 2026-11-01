import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { QueueService } from '../queue/queue.service';

interface DueMonitor {
  id: string;
  nextCheckAt: Date;
}

@Injectable()
export class SchedulerService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(SchedulerService.name);
  private scanning = false;
  private initialized = false;
  private lastScanAt: Date | null = null;
  private lastQueuedCount = 0;
  private startupTimer: NodeJS.Timeout | null = null;
  private shuttingDown = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly queue: QueueService,
  ) {}

  onApplicationBootstrap(): void {
    this.initialized = true;
    this.startupTimer = setTimeout(() => {
      void this.scanDueMonitors();
    }, 2_000);
    this.startupTimer.unref?.();
    this.logger.log('Scheduler initialized; overdue monitors will be queued after startup');
  }

  onApplicationShutdown(): void {
    this.shuttingDown = true;
    if (this.startupTimer) clearTimeout(this.startupTimer);
    this.logger.log('Scheduler stopped');
  }

  @Interval(15_000)
  async scanDueMonitors(): Promise<void> {
    if (this.scanning || this.shuttingDown) return;
    this.scanning = true;
    try {
      const due = await this.prisma.$queryRaw<DueMonitor[]>(Prisma.sql`
        SELECT "id", "nextCheckAt"
        FROM "Monitor"
        WHERE "pausedAt" IS NULL
          AND "currentStatus" <> 'PAUSED'::"MonitorStatus"
          AND "nextCheckAt" <= NOW()
        ORDER BY "nextCheckAt" ASC
        LIMIT 25
      `);
      this.lastScanAt = new Date();
      this.lastQueuedCount = due.length;
      for (const monitor of due) {
        try {
          await this.queue.addCheck(monitor.id, monitor.nextCheckAt);
        } catch (error) {
          this.logger.warn(
            `Could not queue monitor ${monitor.id}: ${error instanceof Error ? error.message : 'unknown error'}`,
          );
        }
      }
      if (due.length > 0) {
        this.logger.log(`Scheduler queued ${due.length} due monitor(s)`);
      }
    } catch (error) {
      this.logger.error(
        `Scheduler scan failed: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
    } finally {
      this.scanning = false;
    }
  }

  status() {
    return {
      initialized: this.initialized,
      scanning: this.scanning,
      lastScanAt: this.lastScanAt?.toISOString() ?? null,
      lastQueuedCount: this.lastQueuedCount,
    };
  }
}
