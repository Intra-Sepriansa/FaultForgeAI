import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// 1. Resolve monorepo root via import.meta.url and process.cwd()
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const candidates = [
  path.resolve(__dirname, '../../..', '.env'), // monorepo root from packages/config/src
  path.resolve(__dirname, '../../../..', '.env'), // monorepo root from dist
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), '../../.env'),
];

for (const envPath of candidates) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
    break;
  }
}

export const envSchema = z.object({
  // Application
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  HOST: z.string().default('0.0.0.0'),
  WEB_URL: z.string().url().default('http://localhost:5173'),
  API_URL: z.string().url().default('http://localhost:4000'),

  // Database (PostgreSQL)
  DATABASE_URL: z.string().url(),

  // Redis
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().int().positive().default(6379),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_URL: z.string().url().default('redis://localhost:6379/0'),

  // Security & Sessions
  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET must be at least 32 characters long'),
  COOKIE_DOMAIN: z.string().default('localhost'),
  COOKIE_SECURE: z
    .enum(['true', 'false'])
    .transform((val) => val === 'true')
    .default('false'),

  // OIDC
  OIDC_ISSUER_URL: z.string().url().default('http://localhost:4000/api/v1/auth/oidc/mock'),
  OIDC_CLIENT_ID: z.string().default('faultforge-web-client'),
  OIDC_CLIENT_SECRET: z.string().default('faultforge_oidc_secret'),
  OIDC_REDIRECT_URI: z.string().url().default('http://localhost:5173/auth/callback'),

  // AI Provider
  AI_PROVIDER: z.enum(['mock', 'openai', 'anthropic']).default('mock'),
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),

  // Sandbox Controller Limits
  SANDBOX_CONCURRENCY_LIMIT: z.coerce.number().int().positive().default(5),
  SANDBOX_TIMEOUT_MS: z.coerce.number().int().positive().default(60000),
  SANDBOX_CPU_LIMIT: z.coerce.number().positive().default(0.5),
  SANDBOX_MEMORY_MB: z.coerce.number().int().positive().default(256),

  // Telemetry & Logs
  OTEL_SERVICE_NAME: z.string().default('faultforge-platform'),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().url().default('http://localhost:4318'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error', 'fatal']).default('info'),
});

export type AppConfig = z.infer<typeof envSchema>;

/**
 * Validates and returns parsed environment configuration.
 * Throws detailed error if any mandatory environment variable is missing or invalid.
 */
export function validateEnv(customEnv?: Record<string, unknown>): AppConfig {
  const source = customEnv ?? process.env;
  const result = envSchema.safeParse(source);

  if (!result.success) {
    const errorDetails = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`[FaultForge Config] Environment validation failed:\n${errorDetails}`);
  }

  return result.data;
}

export const config = validateEnv();
