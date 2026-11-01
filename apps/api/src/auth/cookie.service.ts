import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CookieOptions, Response } from 'express';
import { ACCESS_COOKIE, REFRESH_COOKIE } from './auth.constants';

@Injectable()
export class CookieService {
  private readonly secure: boolean;
  private readonly sameSite: CookieOptions['sameSite'];

  constructor(private readonly config: ConfigService) {
    this.secure = config.get<string>('NODE_ENV') === 'production';
    this.sameSite = this.secure ? 'none' : 'lax';
  }

  setAuthCookies(response: Response, accessToken: string, refreshToken: string): void {
    response.cookie(ACCESS_COOKIE, accessToken, {
      httpOnly: true,
      secure: this.secure,
      sameSite: this.sameSite,
      path: '/api/v1',
      maxAge: 15 * 60 * 1000,
    });
    response.cookie(REFRESH_COOKIE, refreshToken, {
      httpOnly: true,
      secure: this.secure,
      sameSite: this.sameSite,
      path: '/api/v1/auth',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });
  }

  clearAuthCookies(response: Response): void {
    const base: CookieOptions = {
      httpOnly: true,
      secure: this.secure,
      sameSite: this.sameSite,
    };
    response.clearCookie(ACCESS_COOKIE, { ...base, path: '/api/v1' });
    response.clearCookie(REFRESH_COOKIE, { ...base, path: '/api/v1/auth' });
  }
}
