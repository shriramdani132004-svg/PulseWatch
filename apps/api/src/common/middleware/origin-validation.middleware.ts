import { BadRequestException, Injectable, NestMiddleware } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NextFunction, Request, Response } from 'express';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

@Injectable()
export class OriginValidationMiddleware implements NestMiddleware {
  private readonly allowedOrigins: Set<string>;

  constructor(config: ConfigService) {
    const configured = config.get<string>('FRONTEND_ORIGIN') ?? '';
    const origins = configured
      .split(',')
      .map((origin) => origin.trim().replace(/\/$/, ''))
      .filter(Boolean);
    if (config.get<string>('NODE_ENV') !== 'production') {
      origins.push('http://localhost:3000', 'http://127.0.0.1:3000');
    }
    this.allowedOrigins = new Set(origins);
  }

  use(request: Request, _response: Response, next: NextFunction): void {
    if (SAFE_METHODS.has(request.method)) {
      next();
      return;
    }

    const origin = request.headers.origin;
    if (!origin) {
      next(new BadRequestException('Origin header is required for state-changing requests'));
      return;
    }
    if (!this.allowedOrigins.has(origin.replace(/\/$/, ''))) {
      next(new BadRequestException('Request origin is not allowed'));
      return;
    }
    next();
  }
}
