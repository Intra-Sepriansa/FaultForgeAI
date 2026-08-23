import crypto from 'crypto';

export interface SpanContext {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  traceFlags: string;
}

export interface Span {
  context: SpanContext;
  name: string;
  startTimeMs: number;
  endTimeMs?: number;
  durationMs?: number;
  tags: Record<string, string | number | boolean>;
  events: Array<{ name: string; timestampMs: number; attributes?: Record<string, unknown> }>;
  status: 'OK' | 'ERROR';
  errorMessage?: string;
}

export class Tracer {
  /**
   * Generates a 32-hex character trace ID (128 bits).
   */
  static generateTraceId(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  /**
   * Generates a 16-hex character span ID (64 bits).
   */
  static generateSpanId(): string {
    return crypto.randomBytes(8).toString('hex');
  }

  /**
   * Parses W3C traceparent header (format: 00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01).
   */
  static parseTraceparent(header?: string): SpanContext {
    if (header) {
      const match = /^00-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})$/i.exec(header.trim());
      if (match && match[1] && match[2] && match[3]) {
        return {
          traceId: match[1],
          spanId: this.generateSpanId(),
          parentSpanId: match[2],
          traceFlags: match[3],
        };
      }
    }

    return {
      traceId: this.generateTraceId(),
      spanId: this.generateSpanId(),
      traceFlags: '01',
    };
  }

  /**
   * Serializes SpanContext into W3C traceparent header string.
   */
  static formatTraceparent(ctx: SpanContext): string {
    return `00-${ctx.traceId}-${ctx.spanId}-${ctx.traceFlags}`;
  }

  /**
   * Creates a new span.
   */
  static startSpan(name: string, parentContext?: SpanContext): Span {
    const context: SpanContext = parentContext
      ? {
          traceId: parentContext.traceId,
          spanId: this.generateSpanId(),
          parentSpanId: parentContext.spanId,
          traceFlags: parentContext.traceFlags,
        }
      : {
          traceId: this.generateTraceId(),
          spanId: this.generateSpanId(),
          traceFlags: '01',
        };

    return {
      context,
      name,
      startTimeMs: Date.now(),
      tags: {},
      events: [],
      status: 'OK',
    };
  }

  /**
   * Ends a span and computes total duration.
   */
  static endSpan(span: Span, status: 'OK' | 'ERROR' = 'OK', errorMessage?: string): Span {
    span.endTimeMs = Date.now();
    span.durationMs = span.endTimeMs - span.startTimeMs;
    span.status = status;
    if (errorMessage) {
      span.errorMessage = errorMessage;
    }
    return span;
  }
}
