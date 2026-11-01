import { Body, Controller, HttpCode, HttpStatus, Patch, Post, Res, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { UsersService } from './users.service';
import { ChangePasswordDto, UpdateProfileDto } from './dto/users.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { RequestUser } from '../auth/types/request-user';

@ApiTags('Users')
@ApiCookieAuth('pulsewatch-session')
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Patch('me')
  @ApiOperation({ summary: 'Update the authenticated account profile' })
  async updateProfile(@CurrentUser() user: RequestUser, @Body() dto: UpdateProfileDto) {
    return this.usersService.updateProfile(user.id, dto);
  }

  @Patch('me/password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Change password and revoke all sessions' })
  async changePassword(
    @CurrentUser() user: RequestUser,
    @Body() dto: ChangePasswordDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.usersService.changePassword(user.id, dto, response);
  }

  @Post('me/sessions/revoke-all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke every active session for the account' })
  async revokeAll(@CurrentUser() user: RequestUser, @Res({ passthrough: true }) response: Response) {
    return this.usersService.revokeAllSessions(user.id, response);
  }
}
