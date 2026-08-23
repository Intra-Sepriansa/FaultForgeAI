import Fastify, { type FastifyInstance } from 'fastify';
import { PaymentStore } from './store.js';
import { PaymentFaultManager } from './faults.js';

export function buildPaymentLab(): {
  app: FastifyInstance;
  store: PaymentStore;
  faults: PaymentFaultManager;
} {
  const app = Fastify({ logger: false });
  const store = new PaymentStore();
  const faults = new PaymentFaultManager();

  // Health
  app.get('/health', async () => ({ status: 'ok', service: 'payment-lab' }));

  // Ledger query
  app.get('/payments/ledger', async () => ({ items: store.getLedger() }));

  // Payment Charge (Simulates queue ingestion)
  app.post('/payments/charge', async (request, reply) => {
    const body = request.body as {
      orderId: string;
      amount: number;
      idempotencyKey?: string;
    };

    if (!body || !body.orderId || !body.amount) {
      return reply.status(400).send({ error: 'Missing orderId or amount' });
    }

    // 1. If fault is ACTIVE: Bypass idempotency check and simulate redelivery
    if (faults.isDuplicateRedeliveryActive()) {
      // Intentionally processes twice without idempotency ledger check!
      const payment1 = store.charge({
        orderId: body.orderId,
        amount: body.amount,
        idempotencyKey: body.idempotencyKey,
        status: 'PROCESSED',
      });

      const payment2 = store.charge({
        orderId: body.orderId,
        amount: body.amount,
        idempotencyKey: body.idempotencyKey,
        status: 'PROCESSED',
      });

      return reply.status(200).send({
        success: true,
        charges: [payment1, payment2],
        message: 'Duplicate charge executed under redelivery fault',
      });
    }

    // 2. Normal / Baseline behavior: Enforce idempotency key deduplication
    if (body.idempotencyKey && store.isKeyProcessed(body.idempotencyKey)) {
      return reply.status(200).send({
        success: true,
        status: 'DUPLICATE_IGNORED',
        message: 'Payment with idempotency key already processed.',
      });
    }

    const payment = store.charge({
      orderId: body.orderId,
      amount: body.amount,
      idempotencyKey: body.idempotencyKey,
      status: 'PROCESSED',
    });

    return reply.status(200).send({ success: true, payment });
  });

  // Internal Fault Injections
  app.post('/internal/faults/inject', async (request, reply) => {
    const { scenarioCode } = (request.body as { scenarioCode?: string }) || {};
    faults.inject(scenarioCode || 'PAYMENT_QUEUE_DUPLICATION');
    return reply.status(200).send({ success: true, fault: faults.getConfig() });
  });

  app.post('/internal/faults/reset', async (_request, reply) => {
    faults.reset();
    return reply.status(200).send({ success: true, fault: faults.getConfig() });
  });

  // Snapshots
  app.post('/internal/snapshot/save', async (request, reply) => {
    const { hash } = (request.body as { hash?: string }) || {};
    const snapshotHash = hash || `snap-${Date.now()}`;
    store.saveSnapshot(snapshotHash);
    return reply.status(200).send({ success: true, hash: snapshotHash });
  });

  app.post('/internal/snapshot/restore', async (request, reply) => {
    const { hash } = (request.body as { hash?: string }) || {};
    if (!hash) return reply.status(400).send({ error: 'Missing hash' });
    const success = store.restoreSnapshot(hash);
    return reply.status(success ? 200 : 404).send({ success, hash });
  });

  return { app, store, faults };
}
