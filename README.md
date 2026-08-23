# FaultForge AI — Controlled Chaos Engineering & Agentic Incident Adjudication Platform

[![CI Pipeline](https://github.com/faultforge/faultforge-ai/actions/workflows/ci.yml/badge.svg)](https://github.com/faultforge/faultforge-ai/actions)
[![TypeScript Strict](https://img.shields.io/badge/TypeScript-5.7%20Strict-blue.svg)](https://www.typescriptlang.org/)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-green.svg)](LICENSE)
[![Vitest](https://img.shields.io/badge/Tested%20with-Vitest-yellow.svg)](https://vitest.dev/)

> **FaultForge AI** is an enterprise-grade platform for **controlled chaos injection**, **multi-agent telemetry investigation**, **double-blind AI solution adjudication**, and **progressive canary deployment** across distributed microservices.

---

## 🏛 Architecture Overview

FaultForge AI is built as a clean, highly modular TypeScript monorepo powered by **npm workspaces**, **Fastify 5**, **Prisma 6 / PostgreSQL 16**, **Redis 7 / BullMQ**, **React 18 / Vite 6**, and **OpenTelemetry**.

```
                           +-------------------------------------------------------+
                           |            FaultForge Web SPA (React 18)              |
                           |   War Room | Solution Arena | Reference Library       |
                           +---------------------------+---------------------------+
                                                       |
                                            HTTP / Session Cookies
                                                       |
                                                       v
+----------------------------------------------------------------------------------------------------------------+
|                                    Core REST API Gateway (Fastify 5)                                           |
|       /auth | /workspaces | /labs | /incidents | /approvals | /canary | /reference-library | /metrics          |
+------------------------------------+---------------------------------------------------+-----------------------+
                                     |                                                   |
              PostgreSQL Transaction | Transactional Outbox                              | Redis Pub/Sub & Cache
                                     v                                                   v
                     +-------------------------------+                   +-------------------------------+
                     |   PostgreSQL 16 (Prisma)      |                   |    Redis 7 Distributed Cache  |
                     | 18 Models, Strict Relations   |                   | Sessions, Cache, Locks, Jobs  |
                     +---------------+---------------+                   +---------------+---------------+
                                     |                                                   |
                                     | Event Log / Outbox                                | BullMQ Queue
                                     v                                                   v
+------------------------------------+---------------------------------------------------+-----------------------+
|                                      Background Worker Engine (BullMQ)                                         |
|    Outbox Poller -> Incident State Machine (12 States) -> Multi-Agent Runtime (Triage/Backend/Verify/Safety)   |
+------------------------------------+---------------------------------------------------+-----------------------+
                                     |
               Injected Faults & Simulated Telemetry Loops
                                     |
                                     v
       +-----------------------------+-----------------------------+
       |                             |                             |
       v                             v                             v
+--------------------+      +--------------------+      +--------------------+
|    Commerce Lab    |      |    Payment Lab     |      |      Perf Lab      |
| Concurrency & Race |      | Idempotent Ledger  |      | Event-Loop & Heap  |
+--------------------+      +--------------------+      +--------------------+
```

---

## 🚀 Key Platform Capabilities

### 1. Controlled Chaos Engineering Matrix

- **`COMMERCE_RACE_CONDITION`**: Non-atomic read-then-write checkouts causing inventory overselling under high concurrency.
- **`PAYMENT_QUEUE_DUPLICATION`**: At-least-once queue redelivery without idempotency deduplication causing double-charges.
- **`EVENT_LOOP_BLOCKAGE`**: Synchronous CPU-intensive computation blocking the Node.js main thread (>500ms).
- **`CASCADING_TIMEOUT_RETRIES`**: Unjittered immediate retry storms on downstream latency causing cascade failure.
- **`MEMORY_LEAK_CLOSURE`**: Retained closure references in request handlers causing unbounded heap memory growth.

### 2. Autonomous Multi-Agent Investigation Runtime

- **`TriageAgent`**: Analyzes OpenTelemetry traces, structured JSON error logs, and Prometheus metrics to formulate ranked hypotheses with confidence scores.
- **`BackendAgent`**: Synthesizes minimal, idiomatic, backward-compatible TypeScript/SQL patches.
- **`VerificationAgent`**: Executes deterministic invariant assertions and concurrent load reproductions.
- **`SafetyAgent`**: Verifies patches against security policies (preventing SQLi, IDOR, and auth bypasses).

### 3. Double-Blind Evaluation Arena

- **Cryptographic Blinding**: Anonymizes candidate patches under randomized Greek aliases (`Candidate ALPHA`, `Candidate BETA`) to eliminate vendor bias.
- **100-Point Versioned Rubric (`v1.0.0`)**: Evaluates 7 core dimensions:
  - _Correctness & Invariant Proof_ (25 pts)
  - _Security & Exploit Resistance_ (20 pts)
  - _Performance & Latency Overhead_ (15 pts)
  - _API Contract Compatibility_ (10 pts)
  - _Reliability & Fault Tolerance_ (10 pts)
  - _Test Quality & Concurrency_ (10 pts)
  - _Code Clarity & Architecture_ (10 pts)
- **Automatic Disqualification**: Instant score zeroing and disqualification for security vulnerabilities or invariant breaches.

### 4. Human Approval Gate & Canary Deployment

- **Four-Eyes Principle**: Enforces ABAC separation of duties (prohibiting self-approval; requires `REVIEWER` or `ADMIN` role).
- **4-Step Progressive Rollout**: Simulates 5% $\rightarrow$ 25% $\rightarrow$ 50% $\rightarrow$ 100% traffic allocation with real-time error-rate ($\le 0.5\%$) and latency ($P95 \le 50\text{ms}$) monitoring.
- **Instant Automated Rollback**: Triggered automatically in $<100\text{ms}$ if any health threshold is breached.

### 5. Verified Reference Library & SRE Postmortem Generator

- Compiles resolved incidents into auditable case studies.
- Automatically generates Google SRE / PagerDuty compliant Markdown and JSON postmortems with action item tracking.

---

## 📦 Monorepo Workspace Structure

```text
FaultforgeAI/
├── apps/
│   ├── api/                 # Fastify 5 REST Gateway & Swagger OpenAPI
│   ├── worker/              # BullMQ Background Worker & Incident State Machine
│   └── web/                 # React 18 / Vite 6 / Tailwind CSS Product Shell
├── packages/
│   ├── config/              # Centralized type-safe environment configuration (Zod)
│   ├── contracts/           # Shared domain types, state enums, and API schemas
│   ├── database/            # Prisma schema (18 models), Redis client, Outbox repository
│   ├── security/            # RBAC/ABAC matrix, Secret redactor, OIDC PKCE, Redis sessions
│   ├── observability/       # OpenTelemetry W3C tracing, Prometheus metrics, JSON logger
│   ├── agent-runtime/       # Multi-agent orchestrator & deterministic LLM provider
│   ├── arena-eval/          # Double-blind anonymizer & 100-point rubric grader
│   ├── canary-engine/       # Human approval gate & 4-step progressive canary simulator
│   ├── reference-library/   # Case study compiler, search indexer, SRE postmortem generator
│   └── ui/                  # Shared React UI components (DiffViewer, VirtualList, Badges)
├── labs/
│   ├── commerce-lab/        # Micro-commerce lab (concurrency race & retry storm faults)
│   ├── payment-lab/         # Payment processing lab (idempotency & queue duplication faults)
│   └── perf-lab/            # High-throughput runtime lab (event-loop & memory leak faults)
├── infra/
│   ├── docker/              # Multi-stage Dockerfiles & docker-compose.prod.yml
│   └── scripts/             # Quickstart, benchmark, and verification scripts
└── tests/
    ├── integration/         # Incident lifecycle & production config integration tests
    ├── security/            # Tenant isolation, RBAC, and session security tests
    ├── performance/         # High-concurrency load & idempotency benchmark tests
    └── chaos/               # 5-scenario failure matrix & chaos symphony tests
```

---

## ⚡ Quickstart Guide

### Prerequisites

- **Node.js**: `v22.x` (LTS)
- **npm**: `v10.x` or later
- **Docker & Docker Compose**: (for PostgreSQL & Redis containers)

### 1. Clone & Bootstrap Monorepo

```bash
git clone https://github.com/faultforge/faultforge-ai.git
cd FaultforgeAI

# Install all workspace dependencies
npm install

# Copy environment variables
cp .env.example .env
```

### 2. Start PostgreSQL & Redis

```bash
# Start local databases via Docker Compose
docker compose -f infra/docker/docker-compose.yml up -d
```

### 3. Run Database Migrations & Seed Data

```bash
# Run Prisma migrations
npm --workspace=@faultforge/database run db:push

# Seed Organization, Users, Scenarios, and Rubric
npm --workspace=@faultforge/database run db:seed
```

### 4. Start Development Services

```bash
# Terminal 1: Fastify REST API Gateway (Port 4000)
npm --workspace=@faultforge/api run dev

# Terminal 2: Background Worker (BullMQ)
npm --workspace=@faultforge/worker run dev

# Terminal 3: React Web Frontend (Port 5173)
npm --workspace=@faultforge/web run dev
```

### 5. Automated One-Click Quickstart

Alternatively, run the automated bootstrap script:

```bash
./infra/scripts/quickstart.sh
```

---

## 🧪 Comprehensive Quality Checks & Test Suite

FaultForge AI features 19 test files covering 85 automated unit, integration, security, performance, and chaos tests:

```bash
# 1. Format check
npm run format:check

# 2. Linting
npm run lint

# 3. Strict TypeScript typechecking
npm run typecheck

# 4. Run entire Vitest test suite
npm test -- --run
```

### High-Concurrency Benchmark

```bash
npx tsx infra/scripts/benchmark-load.ts
```

---

## 🔒 Security & Role Matrix

| Role         | Workspace View | Lab View | Fault Inject | Agent Dispatch | Eval Run | Patch Approve | Canary Deploy | Reference Publish | Audit View |
| :----------- | :------------: | :------: | :----------: | :------------: | :------: | :-----------: | :-----------: | :---------------: | :--------: |
| **OWNER**    |       ✅       |    ✅    |      ✅      |       ✅       |    ✅    |      ✅       |      ✅       |        ✅         |     ✅     |
| **ADMIN**    |       ✅       |    ✅    |      ✅      |       ✅       |    ✅    |      ✅       |      ✅       |        ✅         |     ✅     |
| **REVIEWER** |       ✅       |    ✅    |      ❌      |       ❌       |    ❌    |      ✅       |      ✅       |        ✅         |     ✅     |
| **ENGINEER** |       ✅       |    ✅    |      ✅      |       ✅       |    ✅    |      ❌       |      ❌       |        ❌         |     ❌     |
| **VIEWER**   |       ✅       |    ✅    |      ❌      |       ❌       |    ❌    |      ❌       |      ❌       |        ❌         |     ❌     |

---

## 📄 License

Apache License 2.0. Copyright (c) 2026 FaultForge AI Contributors.
