import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma, OutboxRepository, Prisma } from '@faultforge/database';
import { requireAuth, requirePermission, requireWorkspaceMember } from '../plugins/guards.js';
import { Permission, AuditLogger } from '@faultforge/security';
import { IncidentStatus, IncidentSeverity } from '@prisma/client';
import { randomUUID } from 'crypto';

const createIncidentSchema = z.object({
  scenarioCode: z.string(),
  severity: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']).default('HIGH'),
  idempotencyKey: z.string().optional(),
});

export const incidentRoutes: FastifyPluginAsync = async (app) => {
  /**
   * Inject fault & trigger a new incident run within a workspace
   */
  app.post(
    '/',
    {
      preHandler: [
        requireAuth(),
        requireWorkspaceMember(),
        requirePermission(Permission.INCIDENT_INJECT),
      ],
      schema: {
        description: 'Inject controlled fault and create new incident run',
        tags: ['Incidents'],
      },
    },
    async (request, reply) => {
      const { workspaceId } = request.params as { workspaceId: string };
      const body = createIncidentSchema.parse(request.body);

      // Check idempotency if key is provided
      if (body.idempotencyKey) {
        const existing = await prisma.incidentRun.findUnique({
          where: { idempotencyKey: body.idempotencyKey },
          include: { scenario: true, faults: true },
        });
        if (existing) {
          return reply.status(200).send(existing);
        }
      }

      // Find Scenario Definition
      const scenario = await prisma.scenarioDefinition.findUnique({
        where: { code: body.scenarioCode },
      });

      if (!scenario) {
        return reply.status(404).send({
          type: 'https://faultforge.ai/errors/not-found',
          title: 'Scenario Definition Not Found',
          status: 404,
          detail: `Scenario '${body.scenarioCode}' is not registered in the catalog.`,
        });
      }

      const snapshotHash = `snap-${Date.now()}-${randomUUID().substring(0, 6)}`;

      // Execute transaction: create IncidentRun, FaultInjection, and OutboxEvent
      const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const incident = await tx.incidentRun.create({
          data: {
            workspaceId,
            scenarioId: scenario.id,
            status: IncidentStatus.FAULT_INJECTED,
            severity: body.severity as IncidentSeverity,
            idempotencyKey: body.idempotencyKey ?? null,
            snapshotHash,
          },
        });

        const fault = await tx.faultInjection.create({
          data: {
            incidentRunId: incident.id,
            payload: scenario.injectionConfig ?? {},
            responseStatus: 'INJECTED',
          },
        });

        await OutboxRepository.enqueue(
          {
            workspaceId,
            eventType: 'INCIDENT_INJECTED',
            payload: {
              incidentRunId: incident.id,
              scenarioCode: scenario.code,
              snapshotHash,
            },
          },
          tx,
        );

        return { incident, fault };
      });

      if (request.user) {
        await AuditLogger.record({
          workspaceId,
          userId: request.user.id,
          action: 'INCIDENT_INJECT',
          resourceType: 'INCIDENT_RUN',
          resourceId: result.incident.id,
          metadata: {
            scenarioCode: body.scenarioCode,
            severity: body.severity,
          },
          ipAddress: request.ip,
        });
      }

      return reply.status(201).send({
        incident: result.incident,
        fault: result.fault,
      });
    },
  );

  /**
   * List incident runs in workspace
   */
  app.get(
    '/',
    {
      preHandler: [
        requireAuth(),
        requireWorkspaceMember(),
        requirePermission(Permission.INCIDENT_VIEW),
      ],
      schema: {
        description: 'List all incident runs in workspace',
        tags: ['Incidents'],
      },
    },
    async (request, reply) => {
      const { workspaceId } = request.params as { workspaceId: string };

      const incidents = await prisma.incidentRun.findMany({
        where: { workspaceId },
        include: {
          scenario: {
            select: { code: true, title: true, category: true, difficulty: true },
          },
          faults: true,
          _count: {
            select: { evidence: true, hypotheses: true, agentRuns: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      return reply.send({ items: incidents });
    },
  );

  /**
   * Get incident run details
   */
  app.get(
    '/:incidentId',
    {
      preHandler: [
        requireAuth(),
        requireWorkspaceMember(),
        requirePermission(Permission.INCIDENT_VIEW),
      ],
      schema: {
        description: 'Get incident run details by ID',
        tags: ['Incidents'],
      },
    },
    async (request, reply) => {
      const { workspaceId, incidentId } = request.params as {
        workspaceId: string;
        incidentId: string;
      };

      const incident = await prisma.incidentRun.findFirst({
        where: { id: incidentId, workspaceId },
        include: {
          scenario: true,
          faults: true,
          evidence: true,
          hypotheses: { orderBy: { rank: 'asc' } },
          agentRuns: { include: { toolCalls: true } },
          evalCases: { include: { candidates: { include: { scores: true, testRuns: true } } } },
        },
      });

      if (!incident) {
        return reply.status(404).send({
          type: 'https://faultforge.ai/errors/not-found',
          title: 'Incident Run Not Found',
          status: 404,
          detail: `Incident run '${incidentId}' not found in workspace '${workspaceId}'.`,
        });
      }

      return reply.send(incident);
    },
  );

  /**
   * Run Double-Blind Rubric Evaluation for Incident
   */
  app.post(
    '/:incidentId/evaluate',
    {
      preHandler: [
        requireAuth(),
        requireWorkspaceMember(),
        requirePermission(Permission.INCIDENT_VIEW),
      ],
      schema: {
        description: 'Run double-blind 100-point rubric evaluation on incident candidate patches',
        tags: ['Arena Evaluation'],
      },
    },
    async (request, reply) => {
      const { workspaceId, incidentId } = request.params as {
        workspaceId: string;
        incidentId: string;
      };

      const incident = await prisma.incidentRun.findFirst({
        where: { id: incidentId, workspaceId },
      });

      if (!incident) {
        return reply.status(404).send({
          type: 'https://faultforge.ai/errors/not-found',
          title: 'Incident Run Not Found',
          status: 404,
          detail: `Incident run '${incidentId}' not found in workspace '${workspaceId}'.`,
        });
      }

      const { ArenaEvaluator } = await import('@faultforge/arena-eval');

      // Standard candidate evaluation profiles
      const candidates = [
        {
          candidateId: 'cand-mutex-a',
          diff: '--- a/labs/commerce-lab/src/server.ts\n+++ b/labs/commerce-lab/src/server.ts\n@@ -20,6 +20,8 @@\n+ await mutex.acquire();\n+ try { store.unsafeSetStock(id, stock - 1); } finally { mutex.release(); }',
          deterministicTestPassed: true,
          concurrencyTestPassed: true,
          hasSecurityFlaws: false,
          latencyOverheadMs: 18.5,
          isIdempotent: true,
        },
        {
          candidateId: 'cand-atomic-b',
          diff: '--- a/labs/commerce-lab/src/server.ts\n+++ b/labs/commerce-lab/src/server.ts\n@@ -25,7 +25,7 @@\n+ const success = store.atomicDecrementStock(productId, 1);',
          deterministicTestPassed: true,
          concurrencyTestPassed: true,
          hasSecurityFlaws: false,
          latencyOverheadMs: 0.8,
          isIdempotent: true,
        },
      ];

      const result = await ArenaEvaluator.evaluateIncidentCandidates(incidentId, candidates);
      return reply.status(200).send(result);
    },
  );

  /**
   * Submit Human Approval Decision (Four-Eyes Principle / Separation of Duties)
   */
  app.post(
    '/:incidentId/approvals',
    {
      preHandler: [
        requireAuth(),
        requireWorkspaceMember(),
        requirePermission(Permission.PATCH_APPROVE),
      ],
      schema: {
        description: 'Submit human reviewer approval or rejection decision',
        tags: ['Human Approval Gate'],
      },
    },
    async (request, reply) => {
      const { incidentId } = request.params as { incidentId: string };
      const body = request.body as { decision: 'APPROVED' | 'REJECTED'; rationale: string };
      const user = request.user!;

      const { HumanApprovalGate } = await import('@faultforge/canary-engine');

      try {
        const result = await HumanApprovalGate.submitDecision({
          incidentRunId: incidentId,
          reviewerUserId: user.id,
          reviewerRole: user.role,
          decision: body.decision,
          rationale: body.rationale || 'Human approval submitted via War Room',
        });
        return reply.status(200).send(result);
      } catch (error) {
        return reply.status(403).send({
          type: 'https://faultforge.ai/errors/forbidden',
          title: 'Approval Gate Violation',
          status: 403,
          detail: (error as Error).message,
        });
      }
    },
  );

  /**
   * Run Progressive Canary Deployment Simulation
   */
  app.post(
    '/:incidentId/canary/deploy',
    {
      preHandler: [
        requireAuth(),
        requireWorkspaceMember(),
        requirePermission(Permission.CANARY_DEPLOY),
      ],
      schema: {
        description: 'Run progressive 4-step canary deployment simulation (5% -> 100%)',
        tags: ['Canary Deployment'],
      },
    },
    async (request, reply) => {
      const { incidentId } = request.params as { incidentId: string };
      const { CanarySimulator } = await import('@faultforge/canary-engine');

      try {
        const result = await CanarySimulator.runSimulation(incidentId);
        return reply.status(200).send(result);
      } catch (error) {
        return reply.status(400).send({
          type: 'https://faultforge.ai/errors/bad-request',
          title: 'Canary Simulation Error',
          status: 400,
          detail: (error as Error).message,
        });
      }
    },
  );

  /**
   * Trigger Instant Rollback
   */
  app.post(
    '/:incidentId/canary/rollback',
    {
      preHandler: [
        requireAuth(),
        requireWorkspaceMember(),
        requirePermission(Permission.CANARY_DEPLOY),
      ],
      schema: {
        description: 'Trigger instant rollback of canary deployment to pre-injection baseline',
        tags: ['Canary Deployment'],
      },
    },
    async (request, reply) => {
      const { incidentId } = request.params as { incidentId: string };
      const body = (request.body as { reason?: string }) || {};
      const { RollbackEngine } = await import('@faultforge/canary-engine');

      const result = await RollbackEngine.executeRollback({
        incidentRunId: incidentId,
        reason: body.reason || 'Manual rollback triggered via API',
        triggeredBy: request.user?.email || 'API Request',
      });

      return reply.status(200).send(result);
    },
  );
};
