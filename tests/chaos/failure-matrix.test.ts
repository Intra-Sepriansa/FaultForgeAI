import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildCommerceLabServer } from '@faultforge/commerce-lab';
import { buildPaymentLab } from '@faultforge/payment-lab';
import { buildPerfLab } from '@faultforge/perf-lab';
import { prisma, disconnectPrisma, disconnectRedis, seedDatabase } from '@faultforge/database';

describe('Chaos Engineering Scenarios & Failure Injection Matrix Tests', () => {
  beforeAll(async () => {
    await seedDatabase();
  });

  afterAll(async () => {
    await disconnectPrisma();
    await disconnectRedis();
  });

  it('validates all 5 failure scenarios are registered in Scenario Catalog', async () => {
    const scenarios = await prisma.scenarioDefinition.findMany({
      orderBy: { code: 'asc' },
    });

    const scenarioCodes = scenarios.map((s) => s.code);
    expect(scenarioCodes).toContain('COMMERCE_RACE_CONDITION');
    expect(scenarioCodes).toContain('PAYMENT_QUEUE_DUPLICATION');
    expect(scenarioCodes).toContain('EVENT_LOOP_BLOCKAGE');
    expect(scenarioCodes).toContain('CASCADING_TIMEOUT_RETRIES');
    expect(scenarioCodes).toContain('MEMORY_LEAK_CLOSURE');
    expect(scenarios.length).toBeGreaterThanOrEqual(5);
  });

  describe('Scenario 4: CASCADING_TIMEOUT_RETRIES (Retry Storm Induced Collapse)', () => {
    it('induces 5x retry amplification and 504 Gateway Timeout when fault is active', async () => {
      const { app } = buildCommerceLabServer();

      // Inject fault
      await app.inject({
        method: 'POST',
        url: '/internal/faults/inject',
        payload: { code: 'CASCADING_TIMEOUT_RETRIES' },
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/orders/downstream-sync',
      });

      expect(res.statusCode).toBe(504);
      const json = res.json();
      expect(json.error).toContain('Downstream service collapsed');
      expect(json.totalAttempts).toBe(5);
      expect(json.amplificationFactor).toBe('5x');

      // Reset and verify resilient mode
      await app.inject({ method: 'POST', url: '/internal/faults/reset' });
      const baselineRes = await app.inject({
        method: 'POST',
        url: '/api/v1/orders/downstream-sync',
      });
      expect(baselineRes.statusCode).toBe(200);
      expect(baselineRes.json().mode).toBe('CIRCUIT_BREAKER_RESILIENT');

      await app.close();
    });
  });

  describe('Scenario 5: MEMORY_LEAK_CLOSURE (Unbounded Heap Growth)', () => {
    it('accumulates retained memory buffers under MEMORY_LEAK_CLOSURE and clears upon reset', async () => {
      const { app } = buildPerfLab();

      // 1. Baseline: zero retained buffers
      const baselineRes = await app.inject({
        method: 'POST',
        url: '/compute/memory-leak',
      });
      expect(baselineRes.statusCode).toBe(200);
      expect(baselineRes.json().mode).toBe('CLEAN_GARBAGE_COLLECTED');
      expect(baselineRes.json().retainedBuffers).toBe(0);

      // 2. Inject fault
      await app.inject({
        method: 'POST',
        url: '/internal/faults/inject',
        payload: { scenarioCode: 'MEMORY_LEAK_CLOSURE' },
      });

      // Fire 10 leaking requests
      for (let i = 0; i < 10; i++) {
        await app.inject({ method: 'POST', url: '/compute/memory-leak' });
      }

      const leakRes = await app.inject({
        method: 'POST',
        url: '/compute/memory-leak',
      });
      expect(leakRes.statusCode).toBe(200);
      const leakJson = leakRes.json();
      expect(leakJson.mode).toBe('LEAKING_CLOSURE');
      expect(leakJson.retainedBuffers).toBe(11);
      expect(leakJson.totalLeakedBytes).toBe(11 * 64 * 1024);

      // 3. Reset clears leaked references
      await app.inject({ method: 'POST', url: '/internal/faults/reset' });
      const afterResetRes = await app.inject({
        method: 'POST',
        url: '/compute/memory-leak',
      });
      expect(afterResetRes.json().mode).toBe('CLEAN_GARBAGE_COLLECTED');

      await app.close();
    });
  });

  describe('Multi-Stage Chaos Symphony Orchestration', () => {
    it('successfully transitions multiple labs through coordinated fault injection and recovery lifecycle', async () => {
      const commerce = buildCommerceLabServer();
      const payment = buildPaymentLab();
      const perf = buildPerfLab();

      // Stage 1: Inject across all 3 microservices simultaneously
      await commerce.app.inject({
        method: 'POST',
        url: '/internal/faults/inject',
        payload: { code: 'COMMERCE_RACE_CONDITION' },
      });
      await payment.app.inject({
        method: 'POST',
        url: '/internal/faults/inject',
        payload: { scenarioCode: 'PAYMENT_QUEUE_DUPLICATION' },
      });
      await perf.app.inject({
        method: 'POST',
        url: '/internal/faults/inject',
        payload: { scenarioCode: 'EVENT_LOOP_BLOCKAGE' },
      });

      expect(commerce.faultManager.isFaultActive('COMMERCE_RACE_CONDITION')).toBe(true);
      expect(payment.faults.isDuplicateRedeliveryActive()).toBe(true);
      expect(perf.faults.isBlockageActive()).toBe(true);

      // Stage 2: Coordinated Emergency Reset
      await commerce.app.inject({ method: 'POST', url: '/internal/faults/reset' });
      await payment.app.inject({ method: 'POST', url: '/internal/faults/reset' });
      await perf.app.inject({ method: 'POST', url: '/internal/faults/reset' });

      expect(commerce.faultManager.getActiveFaults().length).toBe(0);
      expect(payment.faults.isDuplicateRedeliveryActive()).toBe(false);
      expect(perf.faults.isBlockageActive()).toBe(false);

      await commerce.app.close();
      await payment.app.close();
      await perf.app.close();
    });
  });
});
