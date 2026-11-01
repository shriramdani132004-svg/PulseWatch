import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApplication, truncateDatabase } from '../setup/test-app';
import { PrismaService } from '../../src/prisma/prisma.service';
import type { HttpCheckOutcome } from '../../src/common/network/safe-http.client';

const ORIGIN = 'http://localhost:3000';

function failureOutcome(): HttpCheckOutcome {
  return {
    successful: false,
    httpStatus: 500,
    responseTimeMs: 45,
    errorCode: 'UNEXPECTED_STATUS',
    sanitizedErrorMessage: 'HTTP 500 is outside the expected range 200-299',
    redirectCount: 0,
  };
}

function successOutcome(): HttpCheckOutcome {
  return {
    successful: true,
    httpStatus: 200,
    responseTimeMs: 42,
    errorCode: null,
    sanitizedErrorMessage: null,
    redirectCount: 0,
  };
}

describe('PulseWatch monitoring lifecycle (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let perform: jest.Mock;

  beforeAll(async () => {
    perform = jest.fn();
    app = await createTestApplication({ safeHttp: { perform } });
    prisma = app.get(PrismaService);
    await truncateDatabase(prisma);
  });

  afterAll(async () => {
    await app.close();
  });

  it('registers, scopes data to the owner, and records an evidence-based incident lifecycle', async () => {
    const agent = request.agent(app.getHttpServer());
    const email = `owner-${Date.now()}@example.com`;

    const register = await agent
      .post('/api/v1/auth/register')
      .set('Origin', ORIGIN)
      .send({ name: 'E2E Owner', email, password: 'CorrectHorse9' })
      .expect(201);
    expect(register.body.user.email).toBe(email);
    expect(String(register.headers['set-cookie'])).toContain('pw_access=');
    expect(String(register.headers['set-cookie'])).toContain('pw_refresh=');

    const me = await agent.get('/api/v1/auth/me').expect(200);
    expect(me.body.user.name).toBe('E2E Owner');

    const created = await agent
      .post('/api/v1/monitors')
      .set('Origin', ORIGIN)
      .send({
        name: 'Deterministic endpoint',
        description: 'E2E lifecycle target',
        targetUrl: 'https://1.1.1.1/health',
        method: 'GET',
        intervalSeconds: 60,
        timeoutMs: 5000,
        expectedStatusMin: 200,
        expectedStatusMax: 299,
        failureThreshold: 2,
        recoveryThreshold: 1,
        degradedResponseTimeMs: 2000,
      })
      .expect(201);
    const monitor = created.body as {
      id: string;
      currentStatus: string;
      hasCustomHeaders: boolean;
    };
    expect(monitor.currentStatus).toBe('PENDING');
    expect(monitor.hasCustomHeaders).toBe(false);

    const noOrigin = await agent
      .post(`/api/v1/monitors/${monitor.id}/check`)
      .send({})
      .expect(400);
    expect(noOrigin.body.message).toContain('Origin');

    perform.mockResolvedValueOnce(failureOutcome());
    const first = await agent
      .post(`/api/v1/monitors/${monitor.id}/check`)
      .set('Origin', ORIGIN)
      .send({})
      .expect(200);
    expect(first.body.check.successful).toBe(false);
    expect(first.body.monitor.currentStatus).toBe('DEGRADED');
    expect(first.body.monitor.consecutiveFailures).toBe(1);

    const noIncidentYet = await agent.get('/api/v1/incidents').expect(200);
    expect(noIncidentYet.body.pagination.total).toBe(0);

    perform.mockResolvedValueOnce(failureOutcome());
    const second = await agent
      .post(`/api/v1/monitors/${monitor.id}/check`)
      .set('Origin', ORIGIN)
      .send({})
      .expect(200);
    expect(second.body.monitor.currentStatus).toBe('DOWN');
    expect(second.body.monitor.consecutiveFailures).toBe(2);

    const incidents = await agent.get('/api/v1/incidents').expect(200);
    expect(incidents.body.pagination.total).toBe(1);
    const incident = incidents.body.items[0];
    expect(incident.status).toBe('OPEN');
    expect(incident.severity).toBe('HIGH');
    expect(incident.monitorId).toBe(monitor.id);

    const detail = await agent.get(`/api/v1/incidents/${incident.id}`).expect(200);
    expect(detail.body.events.map((event: { eventType: string }) => event.eventType)).toEqual(['CREATED']);

    const acknowledged = await agent
      .post(`/api/v1/incidents/${incident.id}/acknowledge`)
      .set('Origin', ORIGIN)
      .send({})
      .expect(200);
    expect(acknowledged.body.status).toBe('ACKNOWLEDGED');

    perform.mockResolvedValueOnce(successOutcome());
    const recovered = await agent
      .post(`/api/v1/monitors/${monitor.id}/check`)
      .set('Origin', ORIGIN)
      .send({})
      .expect(200);
    expect(recovered.body.check.successful).toBe(true);
    expect(recovered.body.monitor.currentStatus).toBe('OPERATIONAL');

    const resolvedDetail = await agent.get(`/api/v1/incidents/${incident.id}`).expect(200);
    expect(resolvedDetail.body.status).toBe('RESOLVED');
    expect(resolvedDetail.body.resolvedAt).toBeTruthy();
    expect(resolvedDetail.body.events.map((event: { eventType: string }) => event.eventType)).toEqual([
      'CREATED',
      'ACKNOWLEDGED',
      'RESOLVED',
    ]);

    const reports = await agent.get('/api/v1/reports/overview?range=24h').expect(200);
    expect(reports.body.summary.totalObservedChecks).toBe(3);
    expect(reports.body.summary.successfulChecks).toBe(1);
    expect(reports.body.summary.failedChecks).toBe(2);
    expect(reports.body.summary.observedUptimePercent).toBeCloseTo(33.333, 2);
    expect(reports.body.incidents.total).toBe(1);
    expect(reports.body.incidents.resolved).toBe(1);

    const checks = await agent
      .get(`/api/v1/monitors/${monitor.id}/checks?page=1&pageSize=10`)
      .expect(200);
    expect(checks.body.pagination.total).toBe(3);
    expect(checks.body.items[0].source).toBe('MANUAL');

    const otherAgent = request.agent(app.getHttpServer());
    await otherAgent
      .post('/api/v1/auth/register')
      .set('Origin', ORIGIN)
      .send({ name: 'Other Owner', email: `other-${Date.now()}@example.com`, password: 'CorrectHorse9' })
      .expect(201);

    await otherAgent.get(`/api/v1/monitors/${monitor.id}`).expect(404);
    await otherAgent.get(`/api/v1/incidents/${incident.id}`).expect(404);
    const otherMonitors = await otherAgent.get('/api/v1/monitors').expect(200);
    expect(otherMonitors.body.pagination.total).toBe(0);
  });
});
