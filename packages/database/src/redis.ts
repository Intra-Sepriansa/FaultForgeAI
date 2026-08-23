import { Redis } from 'ioredis';
import { config } from '@faultforge/config';

export const redis = new Redis(config.REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: true,
  retryStrategy(times) {
    const delay = Math.min(times * 100, 3000);
    return delay;
  },
});

redis.on('error', (err) => {
  console.error('[FaultForge Redis] Connection error:', err);
});

export async function checkRedisHealth(): Promise<{
  status: 'ok' | 'down';
  latencyMs?: number;
  error?: string;
}> {
  const start = Date.now();
  try {
    const pong = await redis.ping();
    if (pong === 'PONG') {
      return { status: 'ok', latencyMs: Date.now() - start };
    }
    return { status: 'down', error: `Unexpected ping response: ${pong}` };
  } catch (error) {
    return { status: 'down', error: (error as Error).message };
  }
}

export async function disconnectRedis(): Promise<void> {
  await redis.quit();
}
