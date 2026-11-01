import { Controller, Get, Logger, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { QueueService } from '../queue/queue.service';
import { SchedulerService } from '../scheduler/scheduler.service';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly queue: QueueService,
    private readonly scheduler: SchedulerService,
  ) {}

  @Public()
  @Get('live')
  @ApiOperation({ summary: 'Process liveness probe' })
  live() {
    return {
      status: 'ok',
      service: 'pulsewatch-api',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.round(process.uptime()),
    };
  }

  @Public()
  @Get('ready')
  @ApiOperation({ summary: 'Readiness probe for PostgreSQL, Prisma, Redis, queue, and scheduler' })
  async ready(@Res({ passthrough: true }) response: Response) {
    let database = 'down';
    let migrations = 'unknown';
    let redis = 'down';
    let queue = 'down';
    let scheduler = 'down';

    try {
      await this.prisma.ping();
      const rows = await this.prisma.$queryRaw<Array<{ count: number }>>`
        SELECT COUNT(*)::int AS count
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name IN ('User', 'Session', 'Monitor', 'CheckResult', 'Incident', 'IncidentEvent', '_prisma_migrations')
      `;
      database = Number(rows[0]?.count ?? 0) >= 7 ? 'up' : 'missing_tables';
      const applied = await this.prisma.$queryRaw<Array<{ count: number }>>`
        SELECT COUNT(*)::int AS count FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL
      `;
      migrations = Number(applied[0]?.count ?? 0) > 0 ? 'applied' : 'none';
    } catch (error) {
      this.logger.error(
        `Readiness database check failed: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
    }

    const queueHealth = await this.queue.health();
    redis = queueHealth.ok ? 'up' : 'down';
    queue = queueHealth.ok ? 'ok' : 'unavailable';
    const schedulerStatus = this.scheduler.status();
    scheduler = schedulerStatus.initialized ? 'ok' : 'starting';

    const ready = database === 'up' && migrations === 'applied' && redis === 'up' && queue === 'ok';
    response.status(ready ? 200 : 503);
    return {
      status: ready ? 'ready' : 'not_ready',
      timestamp: new Date().toISOString(),
      checks: {
        database,
        migrations,
        redis,
        queue,
        scheduler,
        queueCounts: queueHealth.counts ?? null,
        schedulerLastScanAt: schedulerStatus.lastScanAt,
      },
    };
  }
}
