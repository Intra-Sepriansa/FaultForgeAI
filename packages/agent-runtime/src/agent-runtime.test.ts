import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma, disconnectPrisma, disconnectRedis, seedDatabase } from '@faultforge/database';
import {
  MockDeterministicLLMProvider,
  PromptRenderer,
  TriageAgent,
  BackendAgent,
  VerificationAgent,
  SafetyAgent,
  AgentOrchestrator,
} from './index.js';
import { IncidentStatus } from '@prisma/client';

describe('Multi-Agent Orchestration Runtime Tests', () => {
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

  describe('Deterministic Mock Provider & Prompt Renderer', () => {
    it('renders prompt variables correctly', () => {
      const template = 'Hello {{name}}, welcome to {{project}}!';
      const rendered = PromptRenderer.render(template, {
        name: 'SRE Lead',
        project: 'FaultForge',
      });
      expect(rendered).toBe('Hello SRE Lead, welcome to FaultForge!');
    });

    it('returns structured output with non-zero token accounting', async () => {
      const provider = new MockDeterministicLLMProvider();
      const triage = new TriageAgent(provider);

      const res = await triage.run({
        scenarioCode: 'COMMERCE_RACE_CONDITION',
        scenarioTitle: 'Race Condition Checkout',
        category: 'CONCURRENCY',
        errorLogs: 'Negative stock detected',
      });

      expect(res.data.hypotheses.length).toBeGreaterThan(0);
      expect(res.data.hypotheses[0]?.rank).toBe(1);
      expect(res.promptTokens).toBeGreaterThan(0);
      expect(res.completionTokens).toBeGreaterThan(0);
      expect(res.totalTokens).toBe(res.promptTokens + res.completionTokens);
    });
  });

  describe('Specialist Agents Execution', () => {
    it('executes BackendAgent and produces valid candidate patches', async () => {
      const provider = new MockDeterministicLLMProvider();
      const backend = new BackendAgent(provider);

      const res = await backend.run({
        rootCause: 'Race condition on non-atomic read/write',
        sourceLocation: 'labs/commerce-lab/src/server.ts',
      });

      expect(res.data.candidates.length).toBe(2);
      expect(res.data.candidates[0]?.diff).toContain('---');
      expect(res.data.candidates[1]?.diff).toContain('atomicDecrementStock');
    });

    it('executes VerificationAgent and SafetyAgent on patch diff', async () => {
      const provider = new MockDeterministicLLMProvider();
      const verifier = new VerificationAgent(provider);
      const safety = new SafetyAgent(provider);

      const vRes = await verifier.run({ patchDiff: 'mock-diff' });
      expect(vRes.data.testPassed).toBe(true);
      expect(vRes.data.concurrencyTestPassed).toBe(true);

      const sRes = await safety.run({ patchDiff: 'mock-diff' });
      expect(sRes.data.passedSecurityPolicy).toBe(true);
      expect(sRes.data.recommendation).toBe('APPROVE');
    });
  });

  describe('End-to-End Multi-Agent Orchestration', () => {
    it('coordinates all 4 specialist agents and records AgentRun history in DB', async () => {
      const incident = await prisma.incidentRun.create({
        data: {
          workspaceId,
          scenarioId,
          status: IncidentStatus.INVESTIGATING,
          snapshotHash: 'snap-agent-e2e-1',
        },
      });

      const orchestrator = new AgentOrchestrator();
      const result = await orchestrator.runInvestigation({
        incidentRunId: incident.id,
        scenarioCode: 'COMMERCE_RACE_CONDITION',
        scenarioTitle: 'Inventory Overselling via Race Condition',
        category: 'CONCURRENCY',
        errorLogs: 'Negative stock detected on prod-item-101',
      });

      expect(result.incidentRunId).toBe(incident.id);
      expect(result.candidates.length).toBe(2);
      expect(result.verification.testPassed).toBe(true);
      expect(result.safety.recommendation).toBe('APPROVE');
      expect(result.totalTokensUsed).toBeGreaterThan(200);

      // Verify AgentRun records in PostgreSQL
      const agentRuns = await prisma.agentRun.findMany({
        where: { incidentRunId: incident.id },
      });

      expect(agentRuns.length).toBe(4);
      const roles = agentRuns.map((r) => r.specialistRole);
      expect(roles).toContain('TRIAGE');
      expect(roles).toContain('BACKEND');
      expect(roles).toContain('VERIFICATION');
      expect(roles).toContain('SAFETY');
    });
  });
});
