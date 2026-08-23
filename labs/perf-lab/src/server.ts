import Fastify, { type FastifyInstance } from 'fastify';
import crypto from 'crypto';
import { PerfFaultManager } from './faults.js';

export function buildPerfLab(): {
  app: FastifyInstance;
  faults: PerfFaultManager;
} {
  const app = Fastify({ logger: false });
  const faults = new PerfFaultManager();
  let retainedLeakedBuffers: Buffer[] = [];

  app.get('/health', async () => ({ status: 'ok', service: 'perf-lab' }));

  // Liveness ping
  app.get('/health/ping', async () => ({ pong: true, timestamp: Date.now() }));

  // Compute endpoint
  app.post('/compute/hash-heavy', async (_request, reply) => {
    const startTime = Date.now();

    // 1. If fault is ACTIVE: execute synchronous intensive crypto hashing blocking the event loop
    if (faults.isBlockageActive()) {
      let hash = 'initial-seed';
      for (let i = 0; i < 4000; i++) {
        hash = crypto.createHash('sha256').update(hash).digest('hex');
      }
      return reply.status(200).send({
        success: true,
        mode: 'SYNC_BLOCKING',
        hash,
        durationMs: Date.now() - startTime,
      });
    }

    // 2. Normal / Baseline mode: Non-blocking asynchronous calculation
    const hash = await new Promise<string>((resolve) => {
      setImmediate(() => {
        const computed = crypto.createHash('sha256').update('fast-seed').digest('hex');
        resolve(computed);
      });
    });

    return reply.status(200).send({
      success: true,
      mode: 'ASYNC_OPTIMAL',
      hash,
      durationMs: Date.now() - startTime,
    });
  });

  // Memory Leak simulation endpoint
  app.post('/compute/memory-leak', async (_request, reply) => {
    if (faults.isMemoryLeakActive()) {
      // Intentionally retain 64KB buffer reference in closure array
      const buf = Buffer.alloc(64 * 1024, 'x');
      retainedLeakedBuffers.push(buf);

      return reply.status(200).send({
        success: true,
        mode: 'LEAKING_CLOSURE',
        retainedBuffers: retainedLeakedBuffers.length,
        totalLeakedBytes: retainedLeakedBuffers.length * 64 * 1024,
      });
    }

    // Baseline: Transient buffer collected immediately by GC
    const buf = Buffer.alloc(64 * 1024, 'x');
    return reply.status(200).send({
      success: true,
      mode: 'CLEAN_GARBAGE_COLLECTED',
      retainedBuffers: 0,
      transientBytes: buf.length,
    });
  });

  // Fault Injections
  app.post('/internal/faults/inject', async (request, reply) => {
    const { scenarioCode } = (request.body as { scenarioCode?: string }) || {};
    faults.inject(scenarioCode || 'EVENT_LOOP_BLOCKAGE');
    return reply.status(200).send({ success: true, fault: faults.getConfig() });
  });

  app.post('/internal/faults/reset', async (_request, reply) => {
    faults.reset();
    retainedLeakedBuffers = [];
    return reply.status(200).send({ success: true, fault: faults.getConfig() });
  });

  return { app, faults };
}
