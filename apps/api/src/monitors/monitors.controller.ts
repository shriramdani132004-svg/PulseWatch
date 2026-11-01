import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { MonitorsService } from './monitors.service';
import { CreateMonitorDto, MonitorListQueryDto, UpdateMonitorDto } from './dto/monitors.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { RequestUser } from '../auth/types/request-user';

@ApiTags('Monitors')
@ApiCookieAuth('pulsewatch-session')
@UseGuards(JwtAuthGuard)
@Controller('monitors')
export class MonitorsController {
  constructor(private readonly monitorsService: MonitorsService) {}

  @Get()
  @ApiOperation({ summary: 'List monitors owned by the authenticated user' })
  async list(@CurrentUser() user: RequestUser, @Query() query: MonitorListQueryDto) {
    return this.monitorsService.list(user.id, query);
  }

  @Post()
  @ApiOperation({ summary: 'Create a monitored endpoint' })
  async create(@CurrentUser() user: RequestUser, @Body() dto: CreateMonitorDto) {
    return this.monitorsService.create(user.id, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an owned monitor' })
  async get(@CurrentUser() user: RequestUser, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.monitorsService.get(user.id, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an owned monitor' })
  async update(
    @CurrentUser() user: RequestUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateMonitorDto,
  ) {
    return this.monitorsService.update(user.id, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an owned monitor and its history' })
  async remove(@CurrentUser() user: RequestUser, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.monitorsService.remove(user.id, id);
  }

  @Post(':id/pause')
  @ApiOperation({ summary: 'Pause scheduled checks for an owned monitor' })
  async pause(@CurrentUser() user: RequestUser, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.monitorsService.pause(user.id, id);
  }

  @Post(':id/resume')
  @ApiOperation({ summary: 'Resume scheduled checks for an owned monitor' })
  async resume(@CurrentUser() user: RequestUser, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.monitorsService.resume(user.id, id);
  }
}
