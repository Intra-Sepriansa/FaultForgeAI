import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';
import { Tracer, metrics } from '@faultforge/observability';

declare module 'fastify' {
  interface FastifyRequest {
    correlationId: string;
    traceContext: {
      traceId: string;
      spanId: string;
      parentSpanId?: string;
      traceFlags: string;
    };
    startTimeNs: bigint;
  }
}

const requestIdPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('onRequest', async (request, reply) => {
    request.startTimeNs = process.hrtime.bigint();

    // 1. Parse or initialize W3C traceparent context
    const traceparentHeader = request.headers['traceparent'] as string | undefined;
    const traceContext = Tracer.parseTraceparent(traceparentHeader);

    const correlationId =
      (request.headers['x-correlation-id'] as string) ||
      (request.headers['x-request-id'] as string) ||
      traceContext.traceId;

    request.correlationId = correlationId;
    request.traceContext = traceContext;

    reply.header('x-correlation-id', correlationId);
    reply.header('traceparent', Tracer.formatTraceparent(traceContext));
  });

  fastify.addHook('onResponse', async (request, reply) => {
    if (!request.startTimeNs) return;

    const durationNs = process.hrtime.bigint() - request.startTimeNs;
    const durationSeconds = Number(durationNs) / 1e9;
    const statusCode = reply.statusCode.toString();
    const route = request.routeOptions.url || request.url;

    // Record Prometheus Metrics
    metrics.httpRequestsTotal.inc({
      method: request.method,
      route,
      status_code: statusCode,
    });

    metrics.httpRequestDurationSeconds.observe(
      {
        method: request.method,
        route,
        status_code: statusCode,
      },
      durationSeconds,
    );
  });
};

export default fp(requestIdPlugin, {
  name: 'request-id-plugin',
});
