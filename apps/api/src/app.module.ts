import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { join } from 'path';
import { validateEnvironment } from './config/env.validation';
import { PrismaModule } from './prisma/prisma.module';
import { CryptoModule } from './common/crypto/crypto.module';
import { NetworkModule } from './common/network/network.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { MonitorsModule } from './monitors/monitors.module';
import { ChecksModule } from './checks/checks.module';
import { IncidentsModule } from './incidents/incidents.module';
import { ReportsModule } from './reports/reports.module';
import { QueueModule } from './queue/queue.module';
import { SchedulerModule } from './scheduler/scheduler.module';
import { HealthModule } from './health/health.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { OriginValidationMiddleware } from './common/middleware/origin-validation.middleware';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: [join(process.cwd(), '.env'), join(process.cwd(), '../../.env')],
      validate: validateEnvironment,
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
        redact: {
          paths: [
            'req.headers.authorization',
            'req.headers.cookie',
            'req.headers["x-api-key"]',
            'res.headers["set-cookie"]',
            'req.body.password',
            'req.body.currentPassword',
            'req.body.newPassword',
            'req.body.refreshToken',
            'req.body.customHeaders',
          ],
          censor: '[REDACTED]',
        },
        autoLogging: {
          ignore: (request) => request.url === '/api/v1/health/live' || request.url === '/api/v1/health/ready',
        },
        customProps: () => ({ service: 'pulsewatch-api' }),
      },
    }),
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60_000,
        limit: 120,
      },
    ]),
    ScheduleModule.forRoot(),
    PrismaModule,
    CryptoModule,
    NetworkModule,
    QueueModule,
    SchedulerModule,
    AuthModule,
    UsersModule,
    ChecksModule,
    MonitorsModule,
    IncidentsModule,
    ReportsModule,
    HealthModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(OriginValidationMiddleware).forRoutes('{*path}');
  }
}
