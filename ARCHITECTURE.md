# FaultForge AI — Technical Architecture & Domain Specification

This document details the architectural principles, data flow pipelines, transactional boundaries, and reliability guarantees of the **FaultForge AI** platform.

---

## 1. Domain Entities & Database Model

FaultForge AI utilizes a strictly normalized PostgreSQL 16 schema managed via Prisma ORM:

```mermaid
erDiagram
    ORGANIZATION ||--o{ WORKSPACE : owns
    ORGANIZATION ||--o{ USER : contains
    USER ||--o{ MEMBERSHIP : has
    WORKSPACE ||--o{ MEMBERSHIP : belongs_to
    LAB_DEFINITION ||--o{ SCENARIO_DEFINITION : defines
    WORKSPACE ||--o{ INCIDENT_RUN : tracks
    SCENARIO_DEFINITION ||--o{ INCIDENT_RUN : instantiates
    INCIDENT_RUN ||--o{ FAULT_INJECTION : triggers
    INCIDENT_RUN ||--o{ EVIDENCE_ARTIFACT : collects
    INCIDENT_RUN ||--o{ HYPOTHESIS : formulates
    INCIDENT_RUN ||--o{ AGENT_RUN : executes
    INCIDENT_RUN ||--o{ EVALUATION_CASE : evaluates
    EVALUATION_CASE ||--o{ CANDIDATE_RESPONSE : compares
    CANDIDATE_RESPONSE ||--o{ EVALUATION_SCORE : receives
    EVALUATION_CASE ||--o{ APPROVAL : signs
    OUTBOX_EVENT ||--|| INCIDENT_RUN : delivers
```

---

## 2. Transactional Outbox Pattern & Background Orchestration

To eliminate dual-write hazards between PostgreSQL and Redis/BullMQ, state transitions write to the `outbox_events` table within the same ACID database transaction:

```mermaid
sequenceDiagram
    autonumber
    actor Engineer as SRE Engineer / Operator
    participant API as Fastify REST Gateway
    participant DB as PostgreSQL 16
    participant Poller as OutboxPoller Worker
    participant Queue as Redis 7 (BullMQ)
    participant StateMachine as IncidentStateMachine
    participant AgentRuntime as Multi-Agent Orchestrator

    Engineer->>API: POST /incidents (Trigger Chaos Scenario)
    activate API
    API->>DB: BEGIN TX: Insert IncidentRun + OutboxEvent (INCIDENT_CREATED)
    DB-->>API: COMMIT TX
    API-->>Engineer: 201 Created (Incident Run ID, Status: INITIATED)
    deactivate API

    loop Every 100ms (SELECT FOR UPDATE SKIP LOCKED)
        Poller->>DB: Query unprocessed OutboxEvents
        DB-->>Poller: Batch of pending events
        Poller->>Queue: Enqueue BullMQ job
        Poller->>DB: Mark OutboxEvents as PROCESSED
    end

    Queue->>StateMachine: Process BullMQ Job
    activate StateMachine
    StateMachine->>DB: Transition status: INITIATED -> INVESTIGATING
    StateMachine->>AgentRuntime: Dispatch Multi-Agent Pipeline
    activate AgentRuntime
    AgentRuntime->>AgentRuntime: TriageAgent -> BackendAgent -> VerificationAgent -> SafetyAgent
    AgentRuntime-->>StateMachine: Hypotheses & Verified Code Diff
    deactivate AgentRuntime
    StateMachine->>DB: Save Evidence, Hypotheses, and Candidate Patches
    StateMachine->>DB: Transition status: INVESTIGATING -> EVALUATED
    deactivate StateMachine
```

---

## 3. Double-Blind Adjudication & Rubric Architecture

```mermaid
flowchart TD
    A[Generated Patches from Specialists] --> B[DoubleBlindAnonymizer]
    B -->|Random Greek Alias & UUID| C[Candidate ALPHA]
    B -->|Random Greek Alias & UUID| D[Candidate BETA]

    C --> E[100-Point RubricGraderV1 Engine]
    D --> E

    subgraph Rubric Dimensions
        E --> R1[Correctness & Invariant Proof: Max 25 pts]
        E --> R2[Security & Exploit Resistance: Max 20 pts]
        E --> R3[Performance & Latency Overhead: Max 15 pts]
        E --> R4[API Contract & Schema Compatibility: Max 10 pts]
        E --> R5[Reliability & Fault-Tolerance: Max 10 pts]
        E --> R6[Test Quality & Concurrency: Max 10 pts]
        E --> R7[Code Clarity & Architecture: Max 10 pts]
    end

    R1 & R2 -->|Check Security & Correctness| F{Fail-Safe Disqualification?}
    F -->|Invariant Breach / Security Flaw| G[Score = 0 / DISQUALIFIED]
    F -->|Clean Assertion| H[Calculate Weighted Score]

    H --> I[Select Optimal Winning Patch]
    I --> J[PostgreSQL EvaluationCase Record]
```

---

## 4. Human Approval & Progressive Canary Deployment

1. **Human Approval Gate**:
   - Four-Eyes Principle: Reviewer $\neq$ Author.
   - Enforces `Permission.PATCH_APPROVE`.
   - Transitions `EVALUATED` $\rightarrow$ `APPROVED`.

2. **Canary Deployment Simulator**:
   - **Step 1 (5% Traffic)**: Telemetry evaluation (Error rate $\le 0.5\%$, $P95 \le 50\text{ms}$).
   - **Step 2 (25% Traffic)**: Telemetry evaluation.
   - **Step 3 (50% Traffic)**: Telemetry evaluation.
   - **Step 4 (100% Traffic)**: Full promotion $\rightarrow$ `RESOLVED`.
   - **Automated Instant Rollback**: If any step breaches threshold $\rightarrow$ Instant state restore & `ROLLED_BACK`.

---

## 5. Security Architecture & RFC Standards

- **RFC 7636**: PKCE OAuth2/OIDC Authorization Code flow with SHA-256 code challenge.
- **RFC 7807**: Problem Details for HTTP APIs error response formatting.
- **W3C TraceContext**: OpenTelemetry distributed traceparent propagation (`00-{traceId}-{spanId}-{flags}`).
- **Least Privilege Principle**: All production containers execute under unprivileged `USER node`.
