import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma, disconnectPrisma, disconnectRedis, seedDatabase } from '@faultforge/database';
import { HumanApprovalGate, CanarySimulator, RollbackEngine } from './index.js';
import { IncidentStatus, OrgRole } from '@prisma/client';

describe('Human Approval Gate & Canary Deployment Engine Tests', () => {
  let workspaceId: string;
  let scenarioId: string;
  let adminUserId: string;

  beforeAll(async () => {
    await seedDatabase();
    const ws = await prisma.workspace.findFirstOrThrow();
    const sc = await prisma.scenarioDefinition.findFirstOrThrow();
    const adminUser = await prisma.user.findFirstOrThrow({
      where: { email: 'admin@faultforge.local' },
    });
    workspaceId = ws.id;
    scenarioId = sc.id;
    adminUserId = adminUser.id;
  });

  afterAll(async () => {
    await disconnectPrisma();
    await disconnectRedis();
  });

  describe('Human Approval Gate with Separation of Duties', () => {
    it('rejects approval when attempted by ENGINEER role without PATCH_APPROVE permission', async () => {
      const incident = await prisma.incidentRun.create({
        data: {
          workspaceId,
          scenarioId,
          status: IncidentStatus.EVALUATED,
          snapshotHash: 'snap-appr-test-1',
          evalCases: {
            create: {
              frozenInputs: { test: true },
            },
          },
        },
      });

      await expect(
        HumanApprovalGate.submitDecision({
          incidentRunId: incident.id,
          reviewerUserId: adminUserId,
          reviewerRole: OrgRole.ENGINEER,
          decision: 'APPROVED',
          rationale: 'Looks good to me',
        }),
      ).rejects.toThrow('Approval Gate Rejected');
    });

    it('rejects self-approval when author and reviewer are identical', async () => {
      const incident = await prisma.incidentRun.create({
        data: {
          workspaceId,
          scenarioId,
          status: IncidentStatus.EVALUATED,
          snapshotHash: 'snap-appr-test-self',
          evalCases: {
            create: {
              frozenInputs: { test: true },
            },
          },
        },
      });

      await expect(
        HumanApprovalGate.submitDecision({
          incidentRunId: incident.id,
          reviewerUserId: adminUserId,
          reviewerRole: OrgRole.ADMIN,
          authorUserId: adminUserId, // Self-approval!
          decision: 'APPROVED',
          rationale: 'Self-approved',
        }),
      ).rejects.toThrow('Self-approval violation');
    });

    it('accepts approval from REVIEWER/ADMIN and transitions incident to APPROVED', async () => {
      const incident = await prisma.incidentRun.create({
        data: {
          workspaceId,
          scenarioId,
          status: IncidentStatus.EVALUATED,
          snapshotHash: 'snap-appr-test-2',
          evalCases: {
            create: {
              frozenInputs: { test: true },
            },
          },
        },
      });

      const res = await HumanApprovalGate.submitDecision({
        incidentRunId: incident.id,
        reviewerUserId: adminUserId,
        reviewerRole: OrgRole.ADMIN,
        authorUserId: 'another-engineer-id',
        decision: 'APPROVED',
        rationale: 'Verified atomic conditional decrement and 100-point rubric score.',
      });

      expect(res.success).toBe(true);
      expect(res.decision).toBe('APPROVED');
      expect(res.incidentStatus).toBe(IncidentStatus.APPROVED);

      const updated = await prisma.incidentRun.findUnique({
        where: { id: incident.id },
      });
      expect(updated?.status).toBe(IncidentStatus.APPROVED);
    });
  });

  describe('Progressive Canary Deployment Simulation', () => {
    it('executes 4-step progressive rollout and resolves incident on clean telemetry', async () => {
      const incident = await prisma.incidentRun.create({
        data: {
          workspaceId,
          scenarioId,
          status: IncidentStatus.APPROVED,
          snapshotHash: 'snap-canary-clean-1',
        },
      });

      const result = await CanarySimulator.runSimulation(incident.id);

      expect(result.isSuccess).toBe(true);
      expect(result.finalStatus).toBe(IncidentStatus.RESOLVED);
      expect(result.steps.length).toBe(4);
      expect(result.steps[0]?.trafficPercentage).toBe(5);
      expect(result.steps[3]?.trafficPercentage).toBe(100);
      expect(result.promotedToProduction).toBe(true);
      expect(result.rollbackTriggered).toBe(false);

      const resolved = await prisma.incidentRun.findUnique({
        where: { id: incident.id },
      });
      expect(resolved?.status).toBe(IncidentStatus.RESOLVED);
    });

    it('triggers automated instant rollback when telemetry threshold is breached at 25% traffic', async () => {
      const incident = await prisma.incidentRun.create({
        data: {
          workspaceId,
          scenarioId,
          status: IncidentStatus.APPROVED,
          snapshotHash: 'snap-canary-fail-1',
        },
      });

      const result = await CanarySimulator.runSimulation(incident.id, {
        simulateFailureAtStep: 2, // Simulate failure at 25% traffic
      });

      expect(result.isSuccess).toBe(false);
      expect(result.finalStatus).toBe(IncidentStatus.ROLLED_BACK);
      expect(result.rollbackTriggered).toBe(true);
      expect(result.failureReason).toContain('breached health thresholds');

      const rolledBack = await prisma.incidentRun.findUnique({
        where: { id: incident.id },
      });
      expect(rolledBack?.status).toBe(IncidentStatus.ROLLED_BACK);
    });
  });

  describe('Rollback Engine', () => {
    it('executes instant manual rollback and updates incident status to ROLLED_BACK', async () => {
      const incident = await prisma.incidentRun.create({
        data: {
          workspaceId,
          scenarioId,
          status: IncidentStatus.DEPLOYED_CANARY,
          snapshotHash: 'snap-manual-rollback-1',
        },
      });

      const res = await RollbackEngine.executeRollback({
        incidentRunId: incident.id,
        reason: 'Manual emergency abort by SRE on-call',
      });

      expect(res.success).toBe(true);
      expect(res.status).toBe(IncidentStatus.ROLLED_BACK);
    });
  });
});
