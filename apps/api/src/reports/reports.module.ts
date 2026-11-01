import { Module } from '@nestjs/common';
import { MonitorsModule } from '../monitors/monitors.module';
import { IncidentsModule } from '../incidents/incidents.module';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

@Module({
  imports: [MonitorsModule, IncidentsModule],
  controllers: [ReportsController],
  providers: [ReportsService],
  exports: [ReportsService],
})
export class ReportsModule {}
