export interface ServiceLevelObjective {
  name: string;
  description: string;
  targetPercent: number;
  metricQuery: string;
  errorBudgetThreshold: string;
  runbookRef: string;
}

export const PLATFORM_SLOS: ServiceLevelObjective[] = [
  {
    name: 'API Availability',
    description:
      'Percentage of successful HTTP requests (non-5xx responses) over a 30-day rolling window.',
    targetPercent: 99.9,
    metricQuery:
      'sum(rate(faultforge_http_requests_total{status_code!~"5.."}[5m])) / sum(rate(faultforge_http_requests_total[5m])) * 100',
    errorBudgetThreshold: '0.1% failed requests in 30 days',
    runbookRef: 'docs/runbooks/api-availability-exhaustion.md',
  },
  {
    name: 'API Latency P95',
    description: 'Percentage of API requests completing within 150ms.',
    targetPercent: 95.0,
    metricQuery:
      'histogram_quantile(0.95, sum(rate(faultforge_http_request_duration_seconds_bucket[5m])) by (le)) <= 0.15',
    errorBudgetThreshold: '> 5% requests slower than 150ms in 1 hour',
    runbookRef: 'docs/runbooks/high-latency-degradation.md',
  },
  {
    name: 'Node.js Event Loop Lag',
    description:
      'Event loop lag must remain below 50ms under peak load to prevent latency cascading.',
    targetPercent: 99.0,
    metricQuery: 'faultforge_nodejs_eventloop_lag_seconds{percentile="p99"} <= 0.05',
    errorBudgetThreshold: 'Event loop delay > 50ms sustained for > 1 minute',
    runbookRef: 'docs/runbooks/event-loop-blockage.md',
  },
  {
    name: 'BullMQ Queue Processing Latency',
    description: 'Pending incident outbox jobs must be picked up within 5 seconds.',
    targetPercent: 99.0,
    metricQuery: 'faultforge_bullmq_queue_depth{status="waiting"} <= 100',
    errorBudgetThreshold: 'Queue backlog > 100 jobs for > 5 minutes',
    runbookRef: 'docs/runbooks/queue-backlog-exhaustion.md',
  },
];
