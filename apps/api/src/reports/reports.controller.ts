import { Controller, Get, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { ReportRangeQueryDto } from './dto/reports.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { RequestUser } from '../auth/types/request-user';

@ApiTags('Reports')
@ApiCookieAuth('pulsewatch-session')
@UseGuards(JwtAuthGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Database-backed dashboard metrics and recent activity' })
  async dashboard(@CurrentUser() user: RequestUser, @Query() query: ReportRangeQueryDto) {
    return this.reportsService.dashboard(user.id, query.range);
  }

  @Get('overview')
  @ApiOperation({ summary: 'Historical availability, latency, incident, and monitor reports' })
  async overview(@CurrentUser() user: RequestUser, @Query() query: ReportRangeQueryDto) {
    return this.reportsService.overview(user.id, query.range);
  }

  @Get('monitors/:id')
  @ApiOperation({ summary: 'Historical report for one owned monitor' })
  async monitor(
    @CurrentUser() user: RequestUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query() query: ReportRangeQueryDto,
  ) {
    return this.reportsService.monitorStats(user.id, id, query.range);
  }
}
