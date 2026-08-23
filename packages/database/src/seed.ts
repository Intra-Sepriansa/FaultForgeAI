import { prisma, disconnectPrisma } from './client.js';
import { OrgRole } from '@prisma/client';

export async function seedDatabase(): Promise<void> {
  console.info('[FaultForge Seed] Starting database seed...');

  // 1. Seed Organization
  const defaultOrg = await prisma.organization.upsert({
    where: { slug: 'acme-corp' },
    update: {},
    create: {
      name: 'Acme Corporation',
      slug: 'acme-corp',
    },
  });

  // 2. Seed Default Workspace
  const defaultWorkspace = await prisma.workspace.upsert({
    where: {
      orgId_slug: {
        orgId: defaultOrg.id,
        slug: 'primary-workspace',
      },
    },
    update: {},
    create: {
      orgId: defaultOrg.id,
      name: 'Primary SRE Workspace',
      slug: 'primary-workspace',
    },
  });

  // 3. Seed Users
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@faultforge.local' },
    update: {},
    create: {
      orgId: defaultOrg.id,
      email: 'admin@faultforge.local',
      name: 'Lead SRE Admin',
      oidcSub: 'mock-oidc-sub-admin-001',
    },
  });

  const reviewerUser = await prisma.user.upsert({
    where: { email: 'reviewer@faultforge.local' },
    update: {},
    create: {
      orgId: defaultOrg.id,
      email: 'reviewer@faultforge.local',
      name: 'Senior AI Reviewer',
      oidcSub: 'mock-oidc-sub-reviewer-002',
    },
  });

  // 4. Seed Memberships
  await prisma.membership.upsert({
    where: {
      userId_workspaceId: {
        userId: adminUser.id,
        workspaceId: defaultWorkspace.id,
      },
    },
    update: {},
    create: {
      userId: adminUser.id,
      workspaceId: defaultWorkspace.id,
      role: OrgRole.ADMIN,
    },
  });

  await prisma.membership.upsert({
    where: {
      userId_workspaceId: {
        userId: reviewerUser.id,
        workspaceId: defaultWorkspace.id,
      },
    },
    update: {},
    create: {
      userId: reviewerUser.id,
      workspaceId: defaultWorkspace.id,
      role: OrgRole.REVIEWER,
    },
  });

  // 5. Seed Rubric Version 1.0.0
  await prisma.rubricVersion.upsert({
    where: { version: 'v1.0.0' },
    update: {},
    create: {
      version: 'v1.0.0',
      isActive: true,
      schema: {
        correctness: 25,
        security: 20,
        performance: 15,
        reliability: 10,
        apiDataModel: 10,
        testQuality: 10,
        clarity: 5,
        observabilityAccessibility: 5,
      },
    },
  });

  // 6. Seed Lab Definitions & Scenarios
  const commerceLab = await prisma.labDefinition.upsert({
    where: { name: 'Commerce Lab' },
    update: {},
    create: {
      name: 'Commerce Lab',
      description:
        'Controlled micro-commerce application with inventory, orders, payments, and checkout flows.',
      version: '1.0.0',
    },
  });

  // Seed 5 Scenarios
  const scenarios = [
    {
      code: 'COMMERCE_RACE_CONDITION',
      title: 'Inventory Overselling Race Condition',
      category: 'CONCURRENCY',
      difficulty: 'HARD',
      description:
        'High-concurrency checkout requests decrement stock without proper row-locking or atomic constraints, causing negative inventory.',
      rootCause:
        'Non-atomic read-then-write database update in the checkout handler without transaction isolation or locking.',
      injectionConfig: {
        faultType: 'LATENCY_INJECTION_BETWEEN_READ_AND_WRITE',
        artificialDelayMs: 50,
      },
      referenceTests: {
        command: 'npm run test:repro -- scenario=race-condition',
        expectedFailure: 'Inventory overbooked by concurrent requests',
      },
    },
    {
      code: 'PAYMENT_QUEUE_DUPLICATION',
      title: 'Duplicate Payment Side Effect on Queue Redelivery',
      category: 'ASYNC_MESSAGING',
      difficulty: 'MEDIUM',
      description:
        'At-least-once queue delivery retries payment authorization without idempotency verification, charging the customer twice.',
      rootCause:
        'Absence of idempotency key check in the background payment worker before making external charge call.',
      injectionConfig: {
        faultType: 'FORCE_QUEUE_DUPLICATE_DELIVERY',
        duplicateCount: 2,
      },
      referenceTests: {
        command: 'npm run test:repro -- scenario=queue-duplicate',
        expectedFailure: 'Double charge processed for single order ID',
      },
    },
    {
      code: 'EVENT_LOOP_BLOCKAGE',
      title: 'Node.js Event-Loop Blockage on CPU-Heavy Request',
      category: 'RUNTIME_PERFORMANCE',
      difficulty: 'MEDIUM',
      description:
        'Synchronous intensive hashing or catastrophic regex execution in the request pipeline blocks all concurrent HTTP traffic.',
      rootCause:
        'Synchronous CPU-bound calculation executing directly in Fastify request handler without worker threads.',
      injectionConfig: {
        faultType: 'INJECT_SYNC_CPU_LOAD',
        iterations: 10000000,
      },
      referenceTests: {
        command: 'npm run test:repro -- scenario=event-loop',
        expectedFailure: 'Event loop lag exceeds 500ms threshold under load',
      },
    },
    {
      code: 'CASCADING_TIMEOUT_RETRIES',
      title: 'Cascading Timeout Retry Storm on Downstream Latency Spike',
      category: 'RESILIENCE',
      difficulty: 'HARD',
      description:
        'Immediate unjittered retries upon downstream gateway timeout amplify load by 5x, inducing complete downstream collapse.',
      rootCause:
        'Lack of exponential backoff with full jitter and absence of circuit breaker in HTTP client adapter.',
      injectionConfig: {
        faultType: 'INJECT_DOWNSTREAM_LATENCY_AND_IMMEDIATE_RETRY',
        downstreamLatencyMs: 300,
        retryCount: 4,
      },
      referenceTests: {
        command: 'npm run test:repro -- scenario=retry-storm',
        expectedFailure: 'Downstream gateway overloaded by amplified retry volume',
      },
    },
    {
      code: 'MEMORY_LEAK_CLOSURE',
      title: 'Heap Memory Exhaustion via Retained Closure Event Listeners',
      category: 'RUNTIME_PERFORMANCE',
      difficulty: 'HARD',
      description:
        'Per-request event listeners registered on global EventEmitter without cleanup cause unbounded heap memory growth.',
      rootCause:
        'Omitting removeListener / once in request lifecycle, preventing garbage collection of response closure contexts.',
      injectionConfig: {
        faultType: 'ACCUMULATE_CLOSURE_EVENT_LISTENERS',
        leakPayloadBytes: 10240,
      },
      referenceTests: {
        command: 'npm run test:repro -- scenario=memory-leak',
        expectedFailure: 'Node.js process heap memory increases monotonically',
      },
    },
  ];

  for (const s of scenarios) {
    const existing = await prisma.scenarioDefinition.findUnique({
      where: { code: s.code },
    });
    if (!existing) {
      try {
        await prisma.scenarioDefinition.create({
          data: {
            labId: commerceLab.id,
            code: s.code,
            title: s.title,
            description: s.description,
            category: s.category,
            difficulty: s.difficulty,
            rootCause: s.rootCause,
            injectionConfig: s.injectionConfig,
            referenceTests: s.referenceTests,
          },
        });
      } catch {
        // Concurrency safe
      }
    }
  }

  console.info('[FaultForge Seed] Database seed completed successfully!');
}

if (process.argv[1]?.endsWith('seed.ts') || process.argv[1]?.endsWith('seed.js')) {
  seedDatabase()
    .catch((err) => {
      console.error('[FaultForge Seed] Error seeding database:', err);
      process.exit(1);
    })
    .finally(() => disconnectPrisma());
}
