import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { buildCommerceLabServer } from './server.js';
import type { FastifyInstance } from 'fastify';

describe('Commerce Lab & Fault Injection Deterministic Tests', () => {
  let app: FastifyInstance;

  beforeEach(() => {
    const lab = buildCommerceLabServer();
    app = lab.app;
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  it('GET /api/v1/products returns initial catalog with 5 stock for prod-item-101', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/products' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    const shirt = body.items.find((p: { id: string }) => p.id === 'prod-item-101');
    expect(shirt.stock).toBe(5);
  });

  it('demonstrates overselling race condition under concurrent requests when COMMERCE_RACE_CONDITION fault is active', async () => {
    // 1. Inject Fault
    const injectRes = await app.inject({
      method: 'POST',
      url: '/internal/faults/inject',
      payload: {
        code: 'COMMERCE_RACE_CONDITION',
        config: { artificialDelayMs: 20 },
      },
    });
    expect(injectRes.statusCode).toBe(201);

    // 2. Fire 10 concurrent checkout requests for a product with only 5 in stock
    const requests = Array.from({ length: 10 }).map((_, i) =>
      app.inject({
        method: 'POST',
        url: '/api/v1/checkout',
        payload: {
          productId: 'prod-item-101',
          quantity: 1,
          customerId: `cust-concurrent-${i}`,
        },
      }),
    );

    const responses = await Promise.all(requests);
    const successfulCheckouts = responses.filter((r) => r.statusCode === 201);

    // In a race condition with artificial delay, more than 5 checkouts succeed (Overselling occurred!)
    expect(successfulCheckouts.length).toBeGreaterThan(5);

    // Verify telemetry logs captured the anomaly
    const eventRes = await app.inject({ method: 'GET', url: '/internal/telemetry/events' });
    const events = JSON.parse(eventRes.body);
    expect(events.items.length).toBeGreaterThan(0);
  });

  it('safely handles concurrent checkouts when fault is inactive (Atomic / Baseline Mode)', async () => {
    // Ensure no fault is active
    await app.inject({ method: 'POST', url: '/internal/faults/reset' });

    // Fire 10 concurrent requests for 5 items
    const requests = Array.from({ length: 10 }).map((_, i) =>
      app.inject({
        method: 'POST',
        url: '/api/v1/checkout',
        payload: {
          productId: 'prod-item-101',
          quantity: 1,
          customerId: `cust-safe-${i}`,
        },
      }),
    );

    const responses = await Promise.all(requests);
    const successfulCheckouts = responses.filter((r) => r.statusCode === 201);
    const rejectedCheckouts = responses.filter((r) => r.statusCode === 409);

    // Exactly 5 succeed, and 5 fail with 409 Out of Stock
    expect(successfulCheckouts.length).toBe(5);
    expect(rejectedCheckouts.length).toBe(5);

    // Final stock must be exactly 0 (no negative overselling)
    const productRes = await app.inject({ method: 'GET', url: '/api/v1/products' });
    const body = JSON.parse(productRes.body);
    const shirt = body.items.find((p: { id: string }) => p.id === 'prod-item-101');
    expect(shirt.stock).toBe(0);
  });
});
