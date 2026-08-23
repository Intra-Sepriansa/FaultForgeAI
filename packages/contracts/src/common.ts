import { z } from 'zod';

/**
 * RFC 7807 Standardized Problem Details for HTTP APIs
 */
export const problemDetailsSchema = z.object({
  type: z.string().url().default('about:blank'),
  title: z.string(),
  status: z.number().int().min(100).max(599),
  detail: z.string(),
  instance: z.string().optional(),
  code: z.string().optional(),
  invalidParams: z
    .array(
      z.object({
        name: z.string(),
        reason: z.string(),
      }),
    )
    .optional(),
  traceId: z.string().optional(),
});

export type ProblemDetails = z.infer<typeof problemDetailsSchema>;

/**
 * Standard Cursor-based Pagination Request Schema
 */
export const cursorPaginationQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  direction: z.enum(['forward', 'backward']).default('forward'),
});

export type CursorPaginationQuery = z.infer<typeof cursorPaginationQuerySchema>;

/**
 * Standard Paginated Response Envelope
 */
export function paginatedResponseSchema<T extends z.ZodTypeAny>(itemSchema: T) {
  return z.object({
    items: z.array(itemSchema),
    nextCursor: z.string().nullable(),
    prevCursor: z.string().nullable(),
    totalCount: z.number().int().nonnegative().optional(),
  });
}

/**
 * Standard Health & Readiness Status Response Schema
 */
export const healthStatusSchema = z.object({
  status: z.enum(['ok', 'degraded', 'unhealthy']),
  version: z.string(),
  uptimeSeconds: z.number(),
  timestamp: z.string().datetime(),
  services: z.record(
    z.string(),
    z.object({
      status: z.enum(['ok', 'down']),
      latencyMs: z.number().optional(),
      error: z.string().optional(),
    }),
  ),
});

export type HealthStatus = z.infer<typeof healthStatusSchema>;
