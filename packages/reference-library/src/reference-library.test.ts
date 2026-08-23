import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma, disconnectPrisma, disconnectRedis, seedDatabase } from '@faultforge/database';
import { CaseStudyCompiler, PostmortemGenerator, ReferenceIndexer } from './index.js';
import { IncidentStatus } from '@prisma/client';

describe('Verified Reference Library & Knowledge Base Tests', () => {
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

  describe('CaseStudyCompiler', () => {
    it('compiles resolved incident into verified case study and postmortem report', async () => {
      const incident = await prisma.incidentRun.create({
        data: {
          workspaceId,
          scenarioId,
          status: IncidentStatus.RESOLVED,
          snapshotHash: 'snap-reflib-test-1',
          hypotheses: {
            create: {
              rank: 1,
              description: 'Time-of-check to time-of-use gap in stock deduction logic',
              confidence: 0.98,
              claimStatus: 'VERIFIED',
              evidenceCites: ['evidence-1'],
            },
          },
        },
      });

      const { caseStudy, postmortem } = await CaseStudyCompiler.compileIncident(
        incident.id,
        adminUserId,
      );

      expect(caseStudy.scenarioCode).toBe('COMMERCE_RACE_CONDITION');
      expect(caseStudy.verifiedDiff).toContain('atomicDecrementStock');
      expect(caseStudy.rubricScore).toBeGreaterThanOrEqual(90);
      expect(postmortem.incidentId).toBe(incident.id);
      expect(postmortem.actionItems.length).toBeGreaterThan(0);
    });

    it('rejects compilation if incident is not resolved/approved', async () => {
      const incident = await prisma.incidentRun.create({
        data: {
          workspaceId,
          scenarioId,
          status: IncidentStatus.INITIATED,
          snapshotHash: 'snap-reflib-fail-1',
        },
      });

      await expect(CaseStudyCompiler.compileIncident(incident.id, adminUserId)).rejects.toThrow(
        'Cannot publish case study',
      );
    });
  });

  describe('PostmortemGenerator', () => {
    it('generates standard Google SRE Markdown formatted document', () => {
      const markdown = PostmortemGenerator.toMarkdown({
        title: 'Inventory Overselling Outage',
        incidentId: 'inc-12345',
        scenarioCode: 'COMMERCE_RACE_CONDITION',
        severity: 'HIGH',
        date: '2026-08-21',
        authors: ['lead-sre@acme.corp'],
        summary: 'Race condition on checkout endpoint caused negative inventory under load.',
        impact: '3 customers bought oversold inventory items.',
        rootCauses: 'Non-atomic read-then-write sequence in handler.',
        trigger: 'Marketing flash sale traffic burst.',
        detection: 'Prometheus latency and event-loop lag alert.',
        resolution: 'Deployed atomic conditional SQL decrement patch.',
        actionItems: [{ action: 'Add DB invariant check', type: 'PREVENTATIVE', owner: 'DBA' }],
        verifiedCodeDiff: '+ atomicDecrementStock(id, 1);',
      });

      expect(markdown).toContain('# SRE Postmortem: Inventory Overselling Outage');
      expect(markdown).toContain('## Root Cause Analysis');
      expect(markdown).toContain('## Action Items & Preventative Measures');
      expect(markdown).toContain('```diff');
    });
  });

  describe('ReferenceIndexer Search & Filtering', () => {
    it('indexes and filters case studies by category and keyword', () => {
      const indexer = new ReferenceIndexer([
        {
          id: 'case-1',
          scenarioCode: 'COMMERCE_RACE_CONDITION',
          title: 'Inventory Overselling Race Condition',
          category: 'CONCURRENCY',
          difficulty: 'HARD',
          rootCauseAnalysis: 'Non-atomic read-then-write gap in checkout.',
          engineeringRationale: 'Atomic SQL conditional decrement.',
          verifiedDiff: 'diff-1',
          reproductionCommand: 'npm test',
          expectedFailureMechanism: 'Oversell',
          rolloutStrategy: 'Canary 5% -> 100%',
          rollbackStrategy: 'Instant rollback',
          rubricScore: 98,
          publishedAt: new Date().toISOString(),
          authorUserId: 'user-1',
        },
        {
          id: 'case-2',
          scenarioCode: 'PAYMENT_QUEUE_DUPLICATION',
          title: 'Duplicate Payment Side Effect on Queue Redelivery',
          category: 'ASYNC_MESSAGING',
          difficulty: 'MEDIUM',
          rootCauseAnalysis: 'Lack of idempotency key verification on queue retry.',
          engineeringRationale: 'Distributed lock and idempotency ledger.',
          verifiedDiff: 'diff-2',
          reproductionCommand: 'npm test',
          expectedFailureMechanism: 'Duplicate charge',
          rolloutStrategy: 'Canary 5% -> 100%',
          rollbackStrategy: 'Instant rollback',
          rubricScore: 95,
          publishedAt: new Date().toISOString(),
          authorUserId: 'user-1',
        },
      ]);

      expect(indexer.getAll().length).toBe(2);

      const concurrencyResults = indexer.search({ category: 'CONCURRENCY' });
      expect(concurrencyResults.length).toBe(1);
      expect(concurrencyResults[0]?.scenarioCode).toBe('COMMERCE_RACE_CONDITION');

      const keywordResults = indexer.search({ keyword: 'idempotency' });
      expect(keywordResults.length).toBe(1);
      expect(keywordResults[0]?.scenarioCode).toBe('PAYMENT_QUEUE_DUPLICATION');
    });
  });
});
