import client, { Registry, Counter, Histogram, Gauge } from 'prom-client';
import { monitorEventLoopDelay, type IntervalHistogram } from 'perf_hooks';

export class MetricsRegistry {
  private static instance: MetricsRegistry;
  public registry: Registry;

  public httpRequestsTotal: Counter<string>;
  public httpRequestDurationSeconds: Histogram<string>;
  public queueDepthGauge: Gauge<string>;
  public eventLoopLagSeconds: Gauge<string>;

  private eventLoopDelayHistogram: IntervalHistogram | null = null;
  private lagIntervalTimer: NodeJS.Timeout | null = null;

  private constructor() {
    this.registry = new Registry();

    // 1. HTTP Request Counter
    this.httpRequestsTotal =
      (this.registry.getSingleMetric('faultforge_http_requests_total') as Counter<string>) ||
      new Counter({
        name: 'faultforge_http_requests_total',
        help: 'Total number of HTTP requests processed by FaultForge API',
        labelNames: ['method', 'route', 'status_code'],
        registers: [this.registry],
      });

    // 2. HTTP Request Duration Histogram
    this.httpRequestDurationSeconds =
      (this.registry.getSingleMetric(
        'faultforge_http_request_duration_seconds',
      ) as Histogram<string>) ||
      new Histogram({
        name: 'faultforge_http_request_duration_seconds',
        help: 'HTTP request execution latency in seconds',
        labelNames: ['method', 'route', 'status_code'],
        buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
        registers: [this.registry],
      });

    // 3. BullMQ Queue Depth Gauge
    this.queueDepthGauge =
      (this.registry.getSingleMetric('faultforge_bullmq_queue_depth') as Gauge<string>) ||
      new Gauge({
        name: 'faultforge_bullmq_queue_depth',
        help: 'Number of pending and active jobs in BullMQ queues',
        labelNames: ['queue_name', 'status'],
        registers: [this.registry],
      });

    // 4. Custom Node.js Event Loop Lag Gauge with percentiles
    this.eventLoopLagSeconds =
      (this.registry.getSingleMetric('faultforge_custom_eventloop_lag_seconds') as Gauge<string>) ||
      new Gauge({
        name: 'faultforge_custom_eventloop_lag_seconds',
        help: 'Node.js event loop lag in seconds measured via perf_hooks',
        labelNames: ['percentile'],
        registers: [this.registry],
      });

    // Collect default Node.js process metrics
    client.collectDefaultMetrics({ register: this.registry, prefix: 'faultforge_proc_' });

    this.startEventLoopMonitoring();
  }

  static getInstance(): MetricsRegistry {
    if (!MetricsRegistry.instance) {
      MetricsRegistry.instance = new MetricsRegistry();
    }
    return MetricsRegistry.instance;
  }

  private startEventLoopMonitoring(): void {
    try {
      this.eventLoopDelayHistogram = monitorEventLoopDelay({ resolution: 20 });
      this.eventLoopDelayHistogram.enable();

      this.lagIntervalTimer = setInterval(() => {
        if (!this.eventLoopDelayHistogram) return;

        // Convert nanoseconds to seconds
        const p50 = this.eventLoopDelayHistogram.percentile(50) / 1e9;
        const p95 = this.eventLoopDelayHistogram.percentile(95) / 1e9;
        const p99 = this.eventLoopDelayHistogram.percentile(99) / 1e9;

        this.eventLoopLagSeconds.set({ percentile: 'p50' }, p50);
        this.eventLoopLagSeconds.set({ percentile: 'p95' }, p95);
        this.eventLoopLagSeconds.set({ percentile: 'p99' }, p99);

        this.eventLoopDelayHistogram.reset();
      }, 1000);
    } catch (err) {
      console.warn('[MetricsRegistry] Event loop delay monitoring not available:', err);
    }
  }

  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }

  getContentType(): string {
    return this.registry.contentType;
  }

  stopMonitoring(): void {
    if (this.lagIntervalTimer) {
      clearInterval(this.lagIntervalTimer);
      this.lagIntervalTimer = null;
    }
    if (this.eventLoopDelayHistogram) {
      this.eventLoopDelayHistogram.disable();
      this.eventLoopDelayHistogram = null;
    }
  }
}

export const metrics = MetricsRegistry.getInstance();
