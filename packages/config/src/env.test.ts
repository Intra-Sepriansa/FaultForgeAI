import { describe, it, expect } from 'vitest';
import { envSchema, validateEnv } from './env.js';

describe('Environment Configuration Validation', () => {
  const validMockEnv = {
    NODE_ENV: 'test',
    PORT: '4000',
    DATABASE_URL: 'postgresql://test_user:test_pass@localhost:5432/test_db',
    REDIS_URL: 'redis://localhost:6379/0',
    SESSION_SECRET: 'super_secret_session_key_that_is_long_enough_32bytes',
    OIDC_ISSUER_URL: 'http://localhost:4000/mock-oidc',
    OIDC_REDIRECT_URI: 'http://localhost:5173/auth/callback',
    OTEL_EXPORTER_OTLP_ENDPOINT: 'http://localhost:4318',
    WEB_URL: 'http://localhost:5173',
    API_URL: 'http://localhost:4000',
  };

  it('successfully parses valid environment variables', () => {
    const parsed = validateEnv(validMockEnv);
    expect(parsed.NODE_ENV).toBe('test');
    expect(parsed.PORT).toBe(4000);
    expect(parsed.SESSION_SECRET).toBe('super_secret_session_key_that_is_long_enough_32bytes');
  });

  it('fails if DATABASE_URL is missing or invalid URL', () => {
    const invalidEnv = { ...validMockEnv, DATABASE_URL: 'invalid-url-format' };
    expect(() => validateEnv(invalidEnv)).toThrow(
      '[FaultForge Config] Environment validation failed',
    );
  });

  it('fails if SESSION_SECRET is shorter than 32 characters', () => {
    const invalidEnv = { ...validMockEnv, SESSION_SECRET: 'short_key' };
    expect(() => validateEnv(invalidEnv)).toThrow(
      'SESSION_SECRET must be at least 32 characters long',
    );
  });

  it('applies safe defaults for optional fields', () => {
    const parsed = envSchema.parse(validMockEnv);
    expect(parsed.AI_PROVIDER).toBe('mock');
    expect(parsed.SANDBOX_CONCURRENCY_LIMIT).toBe(5);
    expect(parsed.LOG_LEVEL).toBe('info');
  });
});
