import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildServer } from './server.js';
import { disconnectPrisma, disconnectRedis, seedDatabase } from '@faultforge/database';

describe('Fastify REST API Gateway Integration Tests', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildServer();
    await app.ready();
    await seedDatabase();
  });

  afterAll(async () => {
    await app.close();
    await disconnectPrisma();
    await disconnectRedis();
  });

  it('GET /api/v1/health returns 200 and liveness status', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/health',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.status).toBe('ok');
    expect(body.uptimeSeconds).toBeGreaterThanOrEqual(0);
    expect(body.timestamp).toBeDefined();
  });

  it('GET /api/v1/ready returns 200 and checks Postgres & Redis', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/ready',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.status).toBe('ok');
    expect(body.services.database.status).toBe('ok');
    expect(body.services.redis.status).toBe('ok');
  });

  it('GET /api/v1/labs returns seeded lab catalog', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/labs',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.items).toBeDefined();
    expect(body.items.length).toBeGreaterThan(0);
    expect(body.items[0].name).toBe('Commerce Lab');
  });

  it('GET /api/v1/labs/scenarios/COMMERCE_RACE_CONDITION returns scenario details', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/labs/scenarios/COMMERCE_RACE_CONDITION',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.code).toBe('COMMERCE_RACE_CONDITION');
    expect(body.title).toContain('Inventory Overselling');
  });

  it('GET non-existent route returns RFC 7807 problem details', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/non-existent-endpoint',
    });

    expect(response.statusCode).toBe(404);
    const body = JSON.parse(response.body);
    expect(body.status).toBe(404);
    expect(body.title).toBeDefined();
    expect(body.traceId).toBeDefined();
  });
});
