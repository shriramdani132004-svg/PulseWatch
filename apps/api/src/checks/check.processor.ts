import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { ChecksService } from './checks.service';
import type { CheckJobData } from '../queue/queue.service';

@Injectable()
@Processor('checks', { concurrency: 5 })
export class CheckProcessor extends WorkerHost {
  private readonly logger = new Logger(CheckProcessor.name);

  constructor(private readonly checksService: ChecksService) {
    super();
  }

  async process(job: Job<CheckJobData>): Promise<void> {
    if (!job.data?.monitorId) {
      throw new Error('Check job is missing monitorId');
    }
    const result = await this.checksService.runScheduledCheck(job.data.monitorId);
    if (result.skipped) {
      this.logger.debug(`Skipped duplicate or ineligible check for monitor ${job.data.monitorId}`);
    }
  }

  onFailed(job: Job<CheckJobData> | undefined, error: Error): void {
    this.logger.error(`Check job ${job?.id ?? 'unknown'} failed: ${error.message}`);
  }
}
