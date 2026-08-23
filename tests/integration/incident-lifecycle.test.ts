import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildServer } from '../../apps/api/src/server.js';
import { disconnectPrisma, disconnectRedis, seedDatabase, prisma } from '@faultforge/database';
import { IncidentStatus } from '@prisma/client';

describe('Incident & Fault Injection Gateway Integration Tests', () => {
  let app: FastifyInstance;
  let adminCookie: string;
  let workspaceId: string;

  beforeAll(async () => {
    app = await buildServer();
    await app.ready();
    await seedDatabase();

    const ws = await prisma.workspace.findFirstOrThrow();
    workspaceId = ws.id;

    // Login as Admin
    const adminRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/mock-login',
      payload: { email: 'admin@faultforge.local', role: 'ADMIN' },
    });
    const setCookie = adminRes.headers['set-cookie'] as string;
    adminCookie = setCookie.split(';')[0]!;
  });

  afterAll(async () => {
    await app.close();
    await disconnectPrisma();
    await disconnectRedis();
  });

  it('POST /api/v1/workspaces/:workspaceId/incidents creates IncidentRun and OutboxEvent', async () => {
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/workspaces/${workspaceId}/incidents`,
      headers: { cookie: adminCookie },
      payload: {
        scenarioCode: 'COMMERCE_RACE_CONDITION',
        severity: 'HIGH',
      },
    });

    expect(response.statusCode).toBe(201);
    const body = JSON.parse(response.body);
    expect(body.incident.id).toBeDefined();
    expect(body.incident.status).toBe(IncidentStatus.FAULT_INJECTED);
    expect(body.fault.responseStatus).toBe('INJECTED');

    // Verify outbox event was created in database
    const outbox = await prisma.outboxEvent.findFirst({
      where: {
        workspaceId,
        eventType: 'INCIDENT_INJECTED',
      },
      orderBy: { createdAt: 'desc' },
    });
    expect(outbox).not.toBeNull();
    expect((outbox?.payload as { scenarioCode: string })?.scenarioCode).toBe(
      'COMMERCE_RACE_CONDITION',
    );
  });

  it('POST /api/v1/workspaces/:workspaceId/incidents respects idempotency key', async () => {
    const idempotencyKey = `idemp-${Date.now()}`;

    // First request
    const firstRes = await app.inject({
      method: 'POST',
      url: `/api/v1/workspaces/${workspaceId}/incidents`,
      headers: { cookie: adminCookie },
      payload: {
        scenarioCode: 'COMMERCE_RACE_CONDITION',
        severity: 'HIGH',
        idempotencyKey,
      },
    });
    expect(firstRes.statusCode).toBe(201);
    const firstBody = JSON.parse(firstRes.body);

    // Duplicate request with identical idempotencyKey
    const secondRes = await app.inject({
      method: 'POST',
      url: `/api/v1/workspaces/${workspaceId}/incidents`,
      headers: { cookie: adminCookie },
      payload: {
        scenarioCode: 'COMMERCE_RACE_CONDITION',
        severity: 'HIGH',
        idempotencyKey,
      },
    });
    expect(secondRes.statusCode).toBe(200);
    const secondBody = JSON.parse(secondRes.body);
    expect(secondBody.id).toBe(firstBody.incident.id);
  });

  it('GET /api/v1/workspaces/:workspaceId/incidents lists created incidents', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/workspaces/${workspaceId}/incidents`,
      headers: { cookie: adminCookie },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.items.length).toBeGreaterThan(0);
    expect(body.items[0].scenario.code).toBe('COMMERCE_RACE_CONDITION');
  });
});
