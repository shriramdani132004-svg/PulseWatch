import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Queue } from 'bullmq';

export interface CheckJobData {
  monitorId: string;
  scheduledAt: string;
}

@Injectable()
export class QueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(QueueService.name);

  constructor(@InjectQueue('checks') private readonly checksQueue: Queue<CheckJobData>) {}

  onModuleInit(): void {
    this.checksQueue.on('error', (error: Error) => {
      this.logger.error(`Queue connection error: ${error.message}`);
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.checksQueue.close();
  }

  async addCheck(monitorId: string, scheduledAt: Date): Promise<void> {
    const jobId = `monitor-${monitorId}-${scheduledAt.getTime()}`;
    const existing = await this.checksQueue.getJob(jobId);
    if (existing) {
      const state = await existing.getState();
      if (state === 'completed' || state === 'failed') {
        try {
          await existing.remove();
        } catch {
          // An active job cannot be removed; the database lease still prevents duplication.
        }
      } else {
        return;
      }
    }

    const added = await this.withTimeout(
      this.checksQueue.add(
        'check',
        { monitorId, scheduledAt: scheduledAt.toISOString() },
        {
          jobId,
          attempts: 3,
          backoff: { type: 'exponential', delay: 5_000 },
          removeOnComplete: { count: 500 },
          removeOnFail: { count: 500 },
        },
      ),
      8_000,
    );
    if (added) {
      this.logger.debug(`Queued check for monitor ${monitorId}`);
    }
  }

  async health(): Promise<{ ok: boolean; counts?: Record<string, number>; error?: string }> {
    try {
      const client = await this.checksQueue.client;
      await (client as unknown as { ping: () => Promise<string> }).ping();
      const counts = await this.checksQueue.getJobCounts(
        'waiting',
        'active',
        'completed',
        'failed',
        'delayed',
      );
      return { ok: true, counts };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : 'Redis unavailable' };
    }
  }

  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T | null> {
    let timer: NodeJS.Timeout | undefined;
    try {
      return await Promise.race([
        promise,
        new Promise<null>((resolve) => {
          timer = setTimeout(() => resolve(null), timeoutMs);
          timer.unref?.();
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}
