import { redis } from './redis.js';

export interface CacheOptions {
  ttlSeconds?: number;
}

export class RedisCacheService {
  private static prefix = 'faultforge:cache:';

  /**
   * Fetches data from cache or computes and stores it.
   */
  static async getOrSet<T>(
    key: string,
    fetcher: () => Promise<T>,
    options: CacheOptions = {},
  ): Promise<T> {
    const fullKey = `${this.prefix}${key}`;
    const ttl = options.ttlSeconds || 300; // 5 minutes default

    try {
      const cached = await redis.get(fullKey);
      if (cached) {
        return JSON.parse(cached) as T;
      }
    } catch {
      // If redis read fails, gracefully fallback to fetcher
    }

    const data = await fetcher();

    try {
      await redis.set(fullKey, JSON.stringify(data), 'EX', ttl);
    } catch {
      // Non-critical cache write failure
    }

    return data;
  }

  /**
   * Invalidates cached keys matching a specific pattern.
   */
  static async invalidate(pattern: string): Promise<number> {
    try {
      const keys = await redis.keys(`${this.prefix}${pattern}`);
      if (keys.length > 0) {
        return await redis.del(...keys);
      }
    } catch {
      // Non-critical
    }
    return 0;
  }
}
