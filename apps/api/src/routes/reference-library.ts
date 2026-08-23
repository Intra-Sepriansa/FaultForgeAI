import type { FastifyPluginAsync } from 'fastify';
import { requireAuth, requirePermission, requireWorkspaceMember } from '../plugins/guards.js';
import { Permission } from '@faultforge/security';
import {
  ReferenceIndexer,
  CaseStudyCompiler,
  PostmortemGenerator,
} from '@faultforge/reference-library';

const defaultCases = [
  {
    id: 'case-commerce-race-condition',
    scenarioCode: 'COMMERCE_RACE_CONDITION',
    title: 'Inventory Overselling via Concurrency Race Condition',
    category: 'CONCURRENCY',
    difficulty: 'HARD',
    rootCauseAnalysis:
      'Time-of-check to time-of-use (TOCTOU) gap in checkout handler caused by asynchronous I/O between read query and write query.',
    engineeringRationale:
      'Enforced atomic conditional decrement in single SQL statement (`UPDATE products SET stock = stock - 1 WHERE id = ? AND stock >= 1`) with optimistic verification.',
    verifiedDiff: `--- a/labs/commerce-lab/src/server.ts\n+++ b/labs/commerce-lab/src/server.ts\n@@ -25,7 +25,7 @@\n-  const currentStock = product.stock;\n-  store.unsafeSetStock(productId, currentStock - 1);\n+  const success = store.atomicDecrementStock(productId, 1);\n+  if (!success) return reply.status(409).send({ error: 'Out of stock' });`,
    reproductionCommand: 'npm run test:repro -- scenario=race-condition',
    expectedFailureMechanism: 'Inventory overbooked by concurrent requests',
    rolloutStrategy:
      '4-step progressive canary deploy with 5% traffic split; verify inventory balance telemetry metric.',
    rollbackStrategy: 'Instant automated rollback upon error rate breach > 0.5%',
    rubricScore: 98,
    publishedAt: '2026-08-21T00:00:00.000Z',
    authorUserId: 'lead-sre-admin',
  },
  {
    id: 'case-payment-queue-duplication',
    scenarioCode: 'PAYMENT_QUEUE_DUPLICATION',
    title: 'Duplicate Payment Side Effect on Queue Redelivery',
    category: 'ASYNC_MESSAGING',
    difficulty: 'MEDIUM',
    rootCauseAnalysis:
      'At-least-once queue delivery redelivered payment authorization jobs without idempotency key checks.',
    engineeringRationale:
      'Implemented distributed Redis lock with PostgreSQL idempotency ledger to guarantee single-processing semantics.',
    verifiedDiff: `--- a/labs/commerce-lab/src/payments.ts\n+++ b/labs/commerce-lab/src/payments.ts\n@@ -10,6 +10,10 @@\n+  const isProcessed = await checkIdempotency(job.id);\n+  if (isProcessed) return { status: 'DUPLICATE_IGNORED' };`,
    reproductionCommand: 'npm run test:repro -- scenario=queue-duplicate',
    expectedFailureMechanism: 'Customer billed multiple times for same order ID',
    rolloutStrategy: 'Canary deployment with double-entry ledger reconciliation',
    rollbackStrategy: 'Instant rollback and message dead-lettering',
    rubricScore: 95,
    publishedAt: '2026-08-21T00:00:00.000Z',
    authorUserId: 'lead-sre-admin',
  },
];

const indexer = new ReferenceIndexer(defaultCases);

export const referenceLibraryRoutes: FastifyPluginAsync = async (app) => {
  /**
   * List / Search Reference Library Cases
   */
  app.get(
    '/',
    {
      schema: {
        description: 'List or search verified reference solutions and case studies',
        tags: ['Reference Library'],
      },
    },
    async (request, reply) => {
      const query = request.query as {
        category?: string;
        difficulty?: string;
        keyword?: string;
      };

      const results = indexer.search(query);
      return reply.status(200).send({ items: results, total: results.length });
    },
  );

  /**
   * Get Specific Reference Case by Scenario Code
   */
  app.get(
    '/:code',
    {
      schema: {
        description: 'Get verified reference case study details and postmortem by scenario code',
        tags: ['Reference Library'],
      },
    },
    async (request, reply) => {
      const { code } = request.params as { code: string };
      const item = indexer.getCase(code.toUpperCase());

      if (!item) {
        return reply.status(404).send({
          type: 'https://faultforge.ai/errors/not-found',
          title: 'Reference Case Not Found',
          status: 404,
          detail: `Reference solution for scenario code '${code}' not found in library.`,
        });
      }

      return reply.status(200).send(item);
    },
  );

  /**
   * Publish Resolved Incident into Reference Library
   */
  app.post(
    '/workspaces/:workspaceId/incidents/:incidentId/publish',
    {
      preHandler: [
        requireAuth(),
        requireWorkspaceMember(),
        requirePermission(Permission.REFERENCE_PUBLISH),
      ],
      schema: {
        description: 'Compile and publish a resolved incident into the Verified Reference Library',
        tags: ['Reference Library'],
      },
    },
    async (request, reply) => {
      const { incidentId } = request.params as { incidentId: string };
      const user = request.user!;

      try {
        const { caseStudy, postmortem } = await CaseStudyCompiler.compileIncident(
          incidentId,
          user.id,
        );

        indexer.addCase(caseStudy);
        const postmortemMarkdown = PostmortemGenerator.toMarkdown(postmortem);

        return reply.status(201).send({
          caseStudy,
          postmortem,
          postmortemMarkdown,
        });
      } catch (error) {
        return reply.status(400).send({
          type: 'https://faultforge.ai/errors/bad-request',
          title: 'Reference Publication Error',
          status: 400,
          detail: (error as Error).message,
        });
      }
    },
  );
};
