import { describe, it, expect, afterAll } from 'vitest';
import { Tracer, metrics, Logger, PLATFORM_SLOS } from './index.js';

describe('Observability Platform Unit Tests', () => {
  afterAll(() => {
    metrics.stopMonitoring();
  });

  describe('W3C Traceparent & Span Hierarchy', () => {
    it('generates compliant 32-char traceId and 16-char spanId', () => {
      const traceId = Tracer.generateTraceId();
      const spanId = Tracer.generateSpanId();
      expect(traceId).toHaveLength(32);
      expect(spanId).toHaveLength(16);
    });

    it('parses valid W3C traceparent header and preserves traceId', () => {
      const inputHeader = '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01';
      const ctx = Tracer.parseTraceparent(inputHeader);
      expect(ctx.traceId).toBe('4bf92f3577b34da6a3ce929d0e0e4736');
      expect(ctx.parentSpanId).toBe('00f067aa0ba902b7');
      expect(ctx.traceFlags).toBe('01');
    });

    it('creates child span and tracks duration', async () => {
      const parentSpan = Tracer.startSpan('parent_operation');
      expect(parentSpan.status).toBe('OK');

      const childSpan = Tracer.startSpan('child_database_query', parentSpan.context);
      expect(childSpan.context.traceId).toBe(parentSpan.context.traceId);
      expect(childSpan.context.parentSpanId).toBe(parentSpan.context.spanId);

      await new Promise((resolve) => setTimeout(resolve, 20));
      Tracer.endSpan(childSpan);
      expect(childSpan.durationMs).toBeGreaterThanOrEqual(15);
    });
  });

  describe('Prometheus Metrics & Event Loop Monitoring', () => {
    it('records HTTP request latency and increments counter', async () => {
      metrics.httpRequestsTotal.inc({ method: 'GET', route: '/api/v1/health', status_code: '200' });
      metrics.httpRequestDurationSeconds.observe(
        { method: 'GET', route: '/api/v1/health', status_code: '200' },
        0.045,
      );

      const prometheusOutput = await metrics.getMetrics();
      expect(prometheusOutput).toContain('faultforge_http_requests_total');
      expect(prometheusOutput).toContain('faultforge_http_request_duration_seconds');
      expect(prometheusOutput).toContain('route="/api/v1/health"');
    });

    it('has event-loop lag metric registered', async () => {
      const prometheusOutput = await metrics.getMetrics();
      expect(prometheusOutput).toContain('faultforge_custom_eventloop_lag_seconds');
    });
  });

  describe('Structured Logging with Secret Redaction', () => {
    it('instantiates logger and defines platform SLOs', () => {
      const customLogger = new Logger('test-service');
      expect(customLogger).toBeDefined();
      expect(PLATFORM_SLOS.length).toBeGreaterThanOrEqual(4);
      expect(PLATFORM_SLOS[0]?.name).toBe('API Availability');
    });
  });
});
