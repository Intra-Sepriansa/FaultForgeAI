import type { FastifyPluginAsync } from 'fastify';
import { prisma, checkRedisHealth } from '@faultforge/database';
import { metrics } from '@faultforge/observability';
import type { HealthStatus } from '@faultforge/contracts';

const startTime = Date.now();

export const healthRoutes: FastifyPluginAsync = async (app) => {
  /**
   * Liveness Probe - Fast check for process responsiveness
   */
  app.get(
    '/health',
    {
      schema: {
        description: 'Liveness probe to check if the Fastify process is running',
        tags: ['Health'],
        response: {
          200: {
            type: 'object',
            properties: {
              status: { type: 'string' },
              uptimeSeconds: { type: 'number' },
              timestamp: { type: 'string' },
            },
          },
        },
      },
    },
    async (_request, reply) => {
      return reply.status(200).send({
        status: 'ok',
        uptimeSeconds: Math.floor((Date.now() - startTime) / 1000),
        timestamp: new Date().toISOString(),
      });
    },
  );

  /**
   * Readiness Probe - Deep dependency check (Postgres & Redis)
   */
  app.get(
    '/ready',
    {
      schema: {
        description: 'Readiness probe checking database and Redis connectivity',
        tags: ['Health'],
      },
    },
    async (_request, reply) => {
      const services: HealthStatus['services'] = {};
      let isHealthy = true;

      // 1. Check PostgreSQL Database Connectivity
      const dbStart = Date.now();
      try {
        await prisma.$queryRaw`SELECT 1`;
        services.database = {
          status: 'ok',
          latencyMs: Date.now() - dbStart,
        };
      } catch (error) {
        isHealthy = false;
        services.database = {
          status: 'down',
          error: (error as Error).message,
        };
      }

      // 2. Check Redis Connectivity
      const redisHealth = await checkRedisHealth();
      services.redis = redisHealth;
      if (redisHealth.status === 'down') {
        isHealthy = false;
      }

      const responsePayload: HealthStatus = {
        status: isHealthy ? 'ok' : 'degraded',
        version: '0.1.0',
        uptimeSeconds: Math.floor((Date.now() - startTime) / 1000),
        timestamp: new Date().toISOString(),
        services,
      };

      const httpStatus = isHealthy ? 200 : 503;
      return reply.status(httpStatus).send(responsePayload);
    },
  );

  /**
   * Prometheus Metrics Exporter Endpoint
   */
  app.get(
    '/metrics',
    {
      schema: {
        description: 'Expose Prometheus metrics for scraping',
        tags: ['Observability'],
      },
    },
    async (_request, reply) => {
      const output = await metrics.getMetrics();
      return reply.header('Content-Type', metrics.getContentType()).send(output);
    },
  );
};
