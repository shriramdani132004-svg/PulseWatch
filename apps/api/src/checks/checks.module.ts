import { Module } from '@nestjs/common';
import { QueueModule } from '../queue/queue.module';
import { ChecksController } from './checks.controller';
import { ChecksService } from './checks.service';
import { CheckProcessor } from './check.processor';

@Module({
  imports: [QueueModule],
  controllers: [ChecksController],
  providers: [ChecksService, CheckProcessor],
  exports: [ChecksService],
})
export class ChecksModule {}
