import { PrismaService } from '../../src/prisma/prisma.service';
import { truncateDatabase } from '../setup/test-app';

describe('PostgreSQL data model integration', () => {
  let prisma: PrismaService;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    await truncateDatabase(prisma);
  });

  afterAll(async () => {
    await truncateDatabase(prisma);
    await prisma.$disconnect();
  });

  it('enforces one active incident per monitor and cascades owned history', async () => {
    const owner = await prisma.user.create({
      data: {
        name: 'Integration Owner',
        email: `integration-${Date.now()}@example.com`,
        passwordHash: 'not-used-in-this-test',
      },
    });
    const monitor = await prisma.monitor.create({
      data: {
        userId: owner.id,
        name: 'Integration monitor',
        targetUrl: 'https://1.1.1.1/health',
        method: 'GET',
        intervalSeconds: 60,
        timeoutMs: 5000,
        expectedStatusMin: 200,
        expectedStatusMax: 299,
        failureThreshold: 2,
        recoveryThreshold: 1,
        degradedResponseTimeMs: 2000,
      },
    });

    await prisma.checkResult.create({
      data: {
        monitorId: monitor.id,
        successful: false,
        httpStatus: 500,
        responseTimeMs: 20,
        errorCode: 'UNEXPECTED_STATUS',
        source: 'MANUAL',
      },
    });

    const firstIncident = await prisma.incident.create({
      data: {
        monitorId: monitor.id,
        title: 'Integration outage',
        description: 'Observed failure threshold reached.',
        status: 'OPEN',
        severity: 'HIGH',
      },
    });
    await prisma.incidentEvent.create({
      data: {
        incidentId: firstIncident.id,
        eventType: 'CREATED',
        description: 'Incident opened by a persisted check transition.',
      },
    });

    await expect(
      prisma.incident.create({
        data: {
          monitorId: monitor.id,
          title: 'Duplicate open incident',
          description: 'This must be rejected by the partial unique index.',
          status: 'OPEN',
          severity: 'HIGH',
        },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });

    await prisma.incident.update({
      where: { id: firstIncident.id },
      data: { status: 'ACKNOWLEDGED', acknowledgedAt: new Date() },
    });

    await expect(
      prisma.incident.create({
        data: {
          monitorId: monitor.id,
          title: 'Duplicate acknowledged incident',
          description: 'Acknowledged incidents also count as active.',
          status: 'OPEN',
          severity: 'HIGH',
        },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });

    await prisma.incident.update({
      where: { id: firstIncident.id },
      data: { status: 'RESOLVED', resolvedAt: new Date() },
    });

    const secondIncident = await prisma.incident.create({
      data: {
        monitorId: monitor.id,
        title: 'Second outage',
        description: 'A new outage may open after the previous incident is resolved.',
        status: 'OPEN',
        severity: 'HIGH',
      },
    });
    expect(secondIncident.id).toBeTruthy();

    await prisma.monitor.delete({ where: { id: monitor.id } });
    const [checks, incidents, events] = await Promise.all([
      prisma.checkResult.count({ where: { monitorId: monitor.id } }),
      prisma.incident.count({ where: { monitorId: monitor.id } }),
      prisma.incidentEvent.count({ where: { incidentId: { in: [firstIncident.id, secondIncident.id] } } }),
    ]);
    expect(checks).toBe(0);
    expect(incidents).toBe(0);
    expect(events).toBe(0);

    const secondOwner = await prisma.user.create({
      data: {
        name: 'Cascade Owner',
        email: `cascade-${Date.now()}@example.com`,
        passwordHash: 'not-used-in-this-test',
      },
    });
    await prisma.session.create({
      data: {
        userId: secondOwner.id,
        refreshTokenHash: `hash-${Date.now()}`,
        expiresAt: new Date(Date.now() + 60_000),
      },
    });
    await prisma.monitor.create({
      data: {
        userId: secondOwner.id,
        name: 'Cascade monitor',
        targetUrl: 'https://1.1.1.1/health',
      },
    });

    await prisma.user.delete({ where: { id: secondOwner.id } });
    const [sessions, monitors] = await Promise.all([
      prisma.session.count({ where: { userId: secondOwner.id } }),
      prisma.monitor.count({ where: { userId: secondOwner.id } }),
    ]);
    expect(sessions).toBe(0);
    expect(monitors).toBe(0);
  });
});
