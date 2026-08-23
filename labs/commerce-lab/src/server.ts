import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { z } from 'zod';
import { CommerceStore } from './store.js';
import { FaultManager } from './faults.js';
import { randomUUID } from 'crypto';

const checkoutSchema = z.object({
  productId: z.string(),
  quantity: z.number().int().positive().default(1),
  customerId: z.string().default('cust-anonymous'),
});

const faultInjectSchema = z.object({
  code: z.string(),
  config: z.record(z.unknown()).optional(),
});

export function buildCommerceLabServer(): {
  app: FastifyInstance;
  store: CommerceStore;
  faultManager: FaultManager;
} {
  const app = Fastify({ logger: false });
  const store = new CommerceStore();
  const faultManager = new FaultManager();

  app.register(cors, { origin: true });

  // 1. List Products
  app.get('/api/v1/products', async () => {
    return { items: store.getProducts() };
  });

  // 2. Checkout Endpoint (Vulnerable to COMMERCE_RACE_CONDITION when fault is active)
  app.post('/api/v1/checkout', async (request, reply) => {
    const body = checkoutSchema.parse(request.body);
    const product = store.getProduct(body.productId);

    if (!product) {
      return reply.status(404).send({ error: 'Product not found' });
    }

    const isRaceConditionActive = faultManager.isFaultActive('COMMERCE_RACE_CONDITION');

    if (isRaceConditionActive) {
      // VULNERABLE PATH:
      // 1. Read stock
      const currentStock = product.stock;
      if (currentStock < body.quantity) {
        faultManager.recordEvent('warn', 'Checkout rejected: Insufficient stock', {
          productId: body.productId,
          currentStock,
          requested: body.quantity,
        });
        return reply.status(409).send({ error: 'Out of stock' });
      }

      // 2. Artificial latency gap between read and write
      const delayMs =
        (faultManager.getFault('COMMERCE_RACE_CONDITION')?.config['artificialDelayMs'] as number) ||
        30;
      await new Promise((resolve) => setTimeout(resolve, delayMs));

      // 3. Non-atomic Write (Overwrites with stale calculation)
      const updatedStock = currentStock - body.quantity;
      store.unsafeSetStock(body.productId, updatedStock);

      const order = {
        id: `ord-${randomUUID().substring(0, 8)}`,
        productId: body.productId,
        quantity: body.quantity,
        status: 'COMPLETED' as const,
        createdAt: new Date().toISOString(),
        totalAmount: product.price * body.quantity,
      };
      store.addOrder(order);

      faultManager.recordEvent('info', 'Vulnerable checkout order placed', {
        orderId: order.id,
        productId: body.productId,
        remainingStock: updatedStock,
      });

      return reply.status(201).send({ success: true, order, remainingStock: updatedStock });
    } else {
      // SAFE PATH (Atomic decrement)
      const success = store.atomicDecrementStock(body.productId, body.quantity);
      if (!success) {
        return reply.status(409).send({ error: 'Out of stock' });
      }

      const order = {
        id: `ord-${randomUUID().substring(0, 8)}`,
        productId: body.productId,
        quantity: body.quantity,
        status: 'COMPLETED' as const,
        createdAt: new Date().toISOString(),
        totalAmount: product.price * body.quantity,
      };
      store.addOrder(order);

      return reply.status(201).send({
        success: true,
        order,
        remainingStock: store.getProduct(body.productId)?.stock,
      });
    }
  });

  // Downstream Synchronous Gateway Call (Simulates cascading retry storm)
  app.post('/api/v1/orders/downstream-sync', async (_request, reply) => {
    const isRetryStormActive = faultManager.isFaultActive('CASCADING_TIMEOUT_RETRIES');

    if (isRetryStormActive) {
      let retryCount = 0;
      for (let i = 0; i < 5; i++) {
        retryCount++;
        faultManager.recordEvent(
          'error',
          `Downstream gateway timeout on attempt ${retryCount}, retrying immediately without jitter`,
          { attempt: retryCount },
          'CASCADING_TIMEOUT_RETRIES',
        );
      }
      return reply.status(504).send({
        error: 'Gateway Timeout: Downstream service collapsed under retry storm',
        totalAttempts: retryCount,
        amplificationFactor: '5x',
      });
    }

    // Normal / Resilient baseline mode: Circuit breaker prevents retry storm
    return reply.status(200).send({
      success: true,
      mode: 'CIRCUIT_BREAKER_RESILIENT',
      attempts: 1,
      message: 'Downstream sync completed with circuit breaker protection',
    });
  });

  // 3. Internal Fault Injection Endpoints
  app.post('/internal/faults/inject', async (request, reply) => {
    const body = faultInjectSchema.parse(request.body);
    const fault = faultManager.inject(body.code, body.config || {});
    return reply.status(201).send({ success: true, fault });
  });

  app.post('/internal/faults/reset', async (_request, reply) => {
    faultManager.reset();
    store.reset();
    return reply.send({ success: true, message: 'Lab environment and faults reset to baseline' });
  });

  app.get('/internal/faults/status', async () => {
    return {
      activeFaults: faultManager.getActiveFaults(),
      snapshot: store.getSnapshot(),
    };
  });

  app.get('/internal/telemetry/events', async (request) => {
    const { limit } = request.query as { limit?: string };
    const count = limit ? parseInt(limit, 10) : 50;
    return { items: faultManager.getEvents(count) };
  });

  return { app, store, faultManager };
}
