import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { buildPerfLab } from './server.js';
import type { FastifyInstance } from 'fastify';

describe('Perf Lab Microservice Unit & Event Loop Fault Tests', () => {
  let app: FastifyInstance;

  beforeEach(() => {
    const lab = buildPerfLab();
    app = lab.app;
  });

  afterAll(async () => {
    await app.close();
  });

  it('runs fast non-blocking async computation in baseline mode', async () => {
    const res = await app.inject({ method: 'POST', url: '/compute/hash-heavy' });
    expect(res.statusCode).toBe(200);
    const json = res.json();
    expect(json.mode).toBe('ASYNC_OPTIMAL');
    expect(json.durationMs).toBeLessThan(20);
  });

  it('executes synchronous blocking computation when EVENT_LOOP_BLOCKAGE is injected', async () => {
    await app.inject({
      method: 'POST',
      url: '/internal/faults/inject',
      payload: { scenarioCode: 'EVENT_LOOP_BLOCKAGE' },
    });

    const res = await app.inject({ method: 'POST', url: '/compute/hash-heavy' });
    expect(res.statusCode).toBe(200);
    const json = res.json();
    expect(json.mode).toBe('SYNC_BLOCKING');
  });

  it('responds quickly to health ping', async () => {
    const res = await app.inject({ method: 'GET', url: '/health/ping' });
    expect(res.statusCode).toBe(200);
    expect(res.json().pong).toBe(true);
  });
});
