import { Module } from '@nestjs/common';
import { QueueModule } from '../queue/queue.module';
import { SchedulerModule } from '../scheduler/scheduler.module';
import { HealthController } from './health.controller';

@Module({
  imports: [QueueModule, SchedulerModule],
  controllers: [HealthController],
})
export class HealthModule {}
