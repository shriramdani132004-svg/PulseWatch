import { Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ChecksService } from './checks.service';
import { CheckListQueryDto } from './dto/checks.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { RequestUser } from '../auth/types/request-user';

@ApiTags('Checks')
@ApiCookieAuth('pulsewatch-session')
@UseGuards(JwtAuthGuard)
@Controller('monitors')
export class ChecksController {
  constructor(private readonly checksService: ChecksService) {}

  @Get(':id/checks')
  @ApiOperation({ summary: 'List persisted check results for an owned monitor' })
  async list(
    @CurrentUser() user: RequestUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query() query: CheckListQueryDto,
  ) {
    return this.checksService.listChecks(user.id, id, query);
  }

  @Post(':id/check')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Run an immediate check and persist the observation' })
  async checkNow(
    @CurrentUser() user: RequestUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.checksService.manualCheck(user.id, id);
  }
}
