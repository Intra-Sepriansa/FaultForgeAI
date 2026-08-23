import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { buildPaymentLab } from './server.js';
import type { FastifyInstance } from 'fastify';

describe('Payment Lab Microservice Unit & Fault Tests', () => {
  let app: FastifyInstance;

  beforeEach(() => {
    const lab = buildPaymentLab();
    app = lab.app;
  });

  afterAll(async () => {
    await app.close();
  });

  it('correctly processes charge with idempotency deduplication in baseline mode', async () => {
    const payload = { orderId: 'ord-1001', amount: 50.0, idempotencyKey: 'idem-key-1' };

    // 1st charge
    const res1 = await app.inject({ method: 'POST', url: '/payments/charge', payload });
    expect(res1.statusCode).toBe(200);
    const json1 = res1.json();
    expect(json1.payment).toBeDefined();

    // 2nd charge with same idempotency key -> DUPLICATE_IGNORED
    const res2 = await app.inject({ method: 'POST', url: '/payments/charge', payload });
    expect(res2.statusCode).toBe(200);
    const json2 = res2.json();
    expect(json2.status).toBe('DUPLICATE_IGNORED');

    // Verify ledger has only 1 record
    const ledgerRes = await app.inject({ method: 'GET', url: '/payments/ledger' });
    expect(ledgerRes.json().items.length).toBe(1);
  });

  it('causes double charge when PAYMENT_QUEUE_DUPLICATION fault is active', async () => {
    // Inject fault
    await app.inject({
      method: 'POST',
      url: '/internal/faults/inject',
      payload: { scenarioCode: 'PAYMENT_QUEUE_DUPLICATION' },
    });

    const payload = { orderId: 'ord-1002', amount: 99.0, idempotencyKey: 'idem-key-2' };
    const res = await app.inject({ method: 'POST', url: '/payments/charge', payload });

    expect(res.statusCode).toBe(200);
    const json = res.json();
    expect(json.charges.length).toBe(2);

    // Verify ledger has 2 records for single order
    const ledgerRes = await app.inject({ method: 'GET', url: '/payments/ledger' });
    expect(ledgerRes.json().items.length).toBe(2);
  });

  it('supports snapshot save and restore', async () => {
    await app.inject({
      method: 'POST',
      url: '/payments/charge',
      payload: { orderId: 'ord-snap', amount: 10.0, idempotencyKey: 'key-snap' },
    });

    const snapRes = await app.inject({
      method: 'POST',
      url: '/internal/snapshot/save',
      payload: { hash: 'snap-pay-1' },
    });
    expect(snapRes.statusCode).toBe(200);

    const restoreRes = await app.inject({
      method: 'POST',
      url: '/internal/snapshot/restore',
      payload: { hash: 'snap-pay-1' },
    });
    expect(restoreRes.statusCode).toBe(200);
  });
});
