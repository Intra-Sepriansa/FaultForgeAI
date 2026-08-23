import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma, disconnectPrisma, disconnectRedis, seedDatabase } from '@faultforge/database';
import { DoubleBlindAnonymizer, RubricGraderV1, ArenaEvaluator } from './index.js';
import { IncidentStatus } from '@prisma/client';

describe('Double-Blind Evaluation Arena & Rubric Grader Tests', () => {
  let workspaceId: string;
  let scenarioId: string;

  beforeAll(async () => {
    await seedDatabase();
    const ws = await prisma.workspace.findFirstOrThrow();
    const sc = await prisma.scenarioDefinition.findFirstOrThrow();
    workspaceId = ws.id;
    scenarioId = sc.id;
  });

  afterAll(async () => {
    await disconnectPrisma();
    await disconnectRedis();
  });

  describe('DoubleBlindAnonymizer', () => {
    it('blinds candidates with random aliases and preserves unblind mapping', () => {
      const items = [
        { candidateId: 'model-gpt4-fix', diff: 'diff-1' },
        { candidateId: 'model-claude-fix', diff: 'diff-2' },
      ];

      const session = DoubleBlindAnonymizer.anonymize(items);
      expect(session.candidates.length).toBe(2);
      expect(session.candidates[0]?.alias).toMatch(/^Candidate-[A-Z]+ \(Blinded\)$/);
      expect(session.candidates[1]?.alias).toMatch(/^Candidate-[A-Z]+ \(Blinded\)$/);

      const unblinded1 = DoubleBlindAnonymizer.unblind(
        session.candidates[0]?.blindedId || '',
        session.unblindMap,
      );
      expect(['model-gpt4-fix', 'model-claude-fix']).toContain(unblinded1);
    });
  });

  describe('RubricGraderV1 100-Point Scoring', () => {
    it('calculates optimal score (100 pts) for production-grade atomic patch', () => {
      const result = RubricGraderV1.evaluate({
        patchDiff: 'atomic patch diff',
        deterministicTestPassed: true,
        concurrencyTestPassed: true,
        hasSecurityFlaws: false,
        latencyOverheadMs: 1.2,
        isIdempotent: true,
      });

      expect(result.totalScore).toBe(100);
      expect(result.isDisqualified).toBe(false);
      expect(result.dimensions.length).toBe(7);
    });

    it('penalizes high latency and locks with lower score', () => {
      const result = RubricGraderV1.evaluate({
        patchDiff: 'mutex patch diff',
        deterministicTestPassed: true,
        concurrencyTestPassed: true,
        hasSecurityFlaws: false,
        latencyOverheadMs: 25.0, // High latency overhead
        isIdempotent: true,
      });

      expect(result.totalScore).toBe(90);
      expect(result.isDisqualified).toBe(false);
    });

    it('disqualifies candidate immediately if security flaw is present', () => {
      const result = RubricGraderV1.evaluate({
        patchDiff: 'vulnerable patch diff',
        deterministicTestPassed: true,
        concurrencyTestPassed: true,
        hasSecurityFlaws: true, // Security flaw!
        latencyOverheadMs: 2.0,
        isIdempotent: true,
      });

      expect(result.isDisqualified).toBe(true);
      expect(result.disqualificationReason).toContain('Failed security policy');
    });
  });

  describe('ArenaEvaluator End-to-End Evaluation & DB Persistence', () => {
    it('evaluates candidates, stores EvaluationCases, and advances incident to EVALUATED', async () => {
      const incident = await prisma.incidentRun.create({
        data: {
          workspaceId,
          scenarioId,
          status: IncidentStatus.INVESTIGATING,
          snapshotHash: 'snap-arena-test-1',
        },
      });

      const candidates = [
        {
          candidateId: 'cand-mutex',
          diff: 'diff-mutex',
          deterministicTestPassed: true,
          concurrencyTestPassed: true,
          hasSecurityFlaws: false,
          latencyOverheadMs: 30,
          isIdempotent: true,
        },
        {
          candidateId: 'cand-atomic',
          diff: 'diff-atomic',
          deterministicTestPassed: true,
          concurrencyTestPassed: true,
          hasSecurityFlaws: false,
          latencyOverheadMs: 1,
          isIdempotent: true,
        },
      ];

      const summary = await ArenaEvaluator.evaluateIncidentCandidates(incident.id, candidates);

      expect(summary.candidates.length).toBe(2);
      expect(summary.winningAlias).toBeDefined();

      // Check PostgreSQL records
      const evalCases = await prisma.evaluationCase.findMany({
        where: { incidentRunId: incident.id },
        include: { candidates: true },
      });
      expect(evalCases.length).toBe(1);
      expect(evalCases[0]?.candidates.length).toBe(2);
      expect(evalCases[0]?.candidates[0]?.blindAlias).toBeDefined();

      const updatedIncident = await prisma.incidentRun.findUnique({
        where: { id: incident.id },
      });
      expect(updatedIncident?.status).toBe(IncidentStatus.EVALUATED);
    });
  });
});
