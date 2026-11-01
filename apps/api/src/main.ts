import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const config = app.get(ConfigService);
  const logger = app.get(Logger);
  app.useLogger(logger);

  const nodeEnv = config.get<string>('NODE_ENV') ?? 'development';
  const port = Number(config.get<string>('PORT') ?? 4000);
  const frontendOrigins = (config.get<string>('FRONTEND_ORIGIN') ?? '')
    .split(',')
    .map((origin) => origin.trim().replace(/\/$/, ''))
    .filter(Boolean);

  const express = app.getHttpAdapter().getInstance();
  express.disable('x-powered-by');
  express.set('trust proxy', 1);

  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );
  app.use(cookieParser());

  app.enableCors({
      origin: (origin: string | undefined, callback: (error: Error | null, allow?: boolean) => void) => {
      if (!origin) {
        callback(null, true);
        return;
      }
      const normalized = origin.replace(/\/$/, '');
      const localOrigins =
        nodeEnv === 'production' ? [] : ['http://localhost:3000', 'http://127.0.0.1:3000'];
      if (frontendOrigins.includes(normalized) || localOrigins.includes(normalized)) {
        callback(null, true);
      } else {
        callback(new Error('Origin is not allowed'), false);
      }
    },
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposedHeaders: [],
    maxAge: 600,
  });

  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
      stopAtFirstError: false,
    }),
  );
  app.enableShutdownHooks();

  const swaggerConfig = new DocumentBuilder()
    .setTitle('PulseWatch API')
    .setDescription(
      'API monitoring and incident management. Authentication uses rotating, HttpOnly refresh sessions. ' +
        'All monitor, check, incident, and report data is scoped to the authenticated account.',
    )
    .setVersion('1.0.0')
    .addCookieAuth('pulsewatch-session', {
      type: 'apiKey',
      in: 'cookie',
      name: 'pw_access',
    })
    .addBearerAuth()
    .addTag('Authentication')
    .addTag('Monitors')
    .addTag('Checks')
    .addTag('Incidents')
    .addTag('Reports')
    .addTag('Users')
    .addTag('Health')
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document, {
    customSiteTitle: 'PulseWatch API Documentation',
    swaggerOptions: { persistAuthorization: true },
  });

  await app.listen(port, '0.0.0.0');
  logger.log(`PulseWatch API listening on 0.0.0.0:${port} (${nodeEnv})`);
}

void bootstrap().catch((error: unknown) => {
  // Startup failures must be visible without printing credentials or request data.
  console.error('PulseWatch API failed to start:', error instanceof Error ? error.message : 'unknown error');
  process.exit(1);
});
