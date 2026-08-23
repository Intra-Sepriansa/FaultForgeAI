import { describe, it, expect, afterAll } from 'vitest';
import { buildCommerceLabServer } from '@faultforge/commerce-lab';
import { buildPaymentLab } from '@faultforge/payment-lab';
import { RedisCacheService, disconnectRedis } from '@faultforge/database';

describe('Performance Hardening, Idempotency, and High-Concurrency Load Tests', () => {
  afterAll(async () => {
    await disconnectRedis();
  });

  describe('Commerce Lab Concurrency Race Invariant', () => {
    it('prevents negative stock inventory under 50 parallel checkout requests (Baseline Mode)', async () => {
      const { app, store } = buildCommerceLabServer();
      store.reset(); // Initial stock for prod-item-101 is 5

      // Fire 50 concurrent checkout requests for 1 stock each
      const requests = Array.from({ length: 50 }, (_, i) =>
        app.inject({
          method: 'POST',
          url: '/api/v1/checkout',
          payload: {
            customerId: `user-${i}`,
            productId: 'prod-item-101',
            quantity: 1,
          },
        }),
      );

      const responses = await Promise.all(requests);
      const successful = responses.filter((r) => r.statusCode === 201).length;
      const failed = responses.filter((r) => r.statusCode === 409).length;
      const remainingStock = store.getProduct('prod-item-101')?.stock ?? 0;

      // In baseline mode, exactly 5 requests succeed (201 Created), 45 fail with 409 (Conflict/Out of stock), and remaining stock is exactly 0 (>= 0 invariant)
      expect(successful).toBe(5);
      expect(failed).toBe(45);
      expect(remainingStock).toBe(0);

      await app.close();
    });
  });

  describe('Payment Lab Idempotency Deduplication Under Concurrency', () => {
    it('guarantees single charge execution across 50 concurrent requests with identical idempotencyKey', async () => {
      const { app, store } = buildPaymentLab();

      const requests = Array.from({ length: 50 }, () =>
        app.inject({
          method: 'POST',
          url: '/payments/charge',
          payload: {
            orderId: 'ord-concurrent-test',
            amount: 75.0,
            idempotencyKey: 'idem-concurrent-key-99',
          },
        }),
      );

      const responses = await Promise.all(requests);
      const processed = responses.filter((r) => r.json().payment !== undefined).length;
      const deduplicated = responses.filter((r) => r.json().status === 'DUPLICATE_IGNORED').length;

      expect(processed).toBe(1);
      expect(deduplicated).toBe(49);
      expect(store.getLedger().length).toBe(1);

      await app.close();
    });
  });

  describe('Redis Cache Service Performance & Invalidation', () => {
    it('caches expensive computed data and serves subsequent requests from Redis', async () => {
      const cacheKey = `test:perf:key:${Date.now()}`;
      await RedisCacheService.invalidate(cacheKey);

      let computationCount = 0;
      const expensiveOperation = async () => {
        computationCount++;
        return { data: 'heavy-computation-result', timestamp: Date.now() };
      };

      // 1st call -> executes fetcher
      const res1 = await RedisCacheService.getOrSet(cacheKey, expensiveOperation, {
        ttlSeconds: 60,
      });
      expect(res1.data).toBe('heavy-computation-result');
      expect(computationCount).toBe(1);

      // 2nd call -> served from cache without incrementing computationCount
      const res2 = await RedisCacheService.getOrSet(cacheKey, expensiveOperation, {
        ttlSeconds: 60,
      });
      expect(res2.data).toBe('heavy-computation-result');
      expect(computationCount).toBe(1);

      // Invalidate cache
      await RedisCacheService.invalidate(cacheKey);

      // 3rd call -> cache miss, re-computes
      const res3 = await RedisCacheService.getOrSet(cacheKey, expensiveOperation, {
        ttlSeconds: 60,
      });
      expect(res3.data).toBe('heavy-computation-result');
      expect(computationCount).toBe(2);
    });
  });
});
