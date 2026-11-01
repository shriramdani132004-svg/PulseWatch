import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import { SafeHttpClient } from '../../src/common/network/safe-http.client';

export async function createTestApplication(options: {
  safeHttp?: Pick<SafeHttpClient, 'perform'>;
} = {}): Promise<INestApplication> {
  const builder = Test.createTestingModule({ imports: [AppModule] });
  if (options.safeHttp) {
    builder.overrideProvider(SafeHttpClient).useValue(options.safeHttp);
  }
  const moduleRef = await builder.compile();
  const app = moduleRef.createNestApplication({ logger: false });
  app.use(cookieParser());
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
  await app.init();
  return app;
}

export async function truncateDatabase(prisma: PrismaService): Promise<void> {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "IncidentEvent", "Incident", "CheckResult", "Monitor", "Session", "User" RESTART IDENTITY CASCADE',
  );
}
