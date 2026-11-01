import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IncidentsService } from './incidents.service';
import { IncidentListQueryDto } from './dto/incidents.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { RequestUser } from '../auth/types/request-user';

@ApiTags('Incidents')
@ApiCookieAuth('pulsewatch-session')
@UseGuards(JwtAuthGuard)
@Controller('incidents')
export class IncidentsController {
  constructor(private readonly incidentsService: IncidentsService) {}

  @Get('summary')
  @ApiOperation({ summary: 'Incident counts for the authenticated account' })
  async summary(@CurrentUser() user: RequestUser) {
    return this.incidentsService.summary(user.id);
  }

  @Get()
  @ApiOperation({ summary: 'List incidents with monitor, status, and severity filters' })
  async list(@CurrentUser() user: RequestUser, @Query() query: IncidentListQueryDto) {
    return this.incidentsService.list(user.id, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an incident and its event timeline' })
  async get(@CurrentUser() user: RequestUser, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.incidentsService.get(user.id, id);
  }

  @Post(':id/acknowledge')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Acknowledge an open incident' })
  async acknowledge(@CurrentUser() user: RequestUser, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.incidentsService.acknowledge(user.id, id);
  }

  @Post(':id/resolve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Manually resolve an incident' })
  async resolve(@CurrentUser() user: RequestUser, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.incidentsService.resolve(user.id, id);
  }
}
