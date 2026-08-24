# @faultforge/observability

Enterprise observability package for FaultForge AI providing W3C distributed tracing, Prometheus metrics collection, event-loop lag monitoring, and structured JSON logging with automatic secret redaction.

## Features
- **W3C Traceparent Context**: Seamless distributed trace context propagation across Fastify and microservices.
- **Prometheus Metrics Registry**: Pre-configured HTTP latency histograms, error rate counters, and custom SLO gauges.
- **Event-Loop Lag Monitor**: Real-time Node.js event-loop blockage detection via `perf_hooks`.
- **Structured JSON Logger**: Zero-dependency, low-overhead logging with automatic JWT and password masking.
