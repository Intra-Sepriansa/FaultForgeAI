import { prisma } from '@faultforge/database';
import { MockDeterministicLLMProvider, type LLMProvider } from './provider.js';
import { TriageAgent } from './specialists/triage.js';
import { BackendAgent } from './specialists/backend.js';
import { VerificationAgent } from './specialists/verification.js';
import { SafetyAgent } from './specialists/safety.js';
import type { CandidatePatch, VerificationOutput, SafetyOutput } from './types.js';

export interface OrchestrationInput {
  incidentRunId: string;
  scenarioCode: string;
  scenarioTitle: string;
  category: string;
  errorLogs: string;
}

export interface OrchestrationResult {
  incidentRunId: string;
  rootCause: string;
  candidates: CandidatePatch[];
  verification: VerificationOutput;
  safety: SafetyOutput;
  totalTokensUsed: number;
  totalDurationMs: number;
}

export class AgentOrchestrator {
  private provider: LLMProvider;
  private triageAgent: TriageAgent;
  private backendAgent: BackendAgent;
  private verificationAgent: VerificationAgent;
  private safetyAgent: SafetyAgent;

  constructor(provider: LLMProvider = new MockDeterministicLLMProvider()) {
    this.provider = provider;
    this.triageAgent = new TriageAgent(this.provider);
    this.backendAgent = new BackendAgent(this.provider);
    this.verificationAgent = new VerificationAgent(this.provider);
    this.safetyAgent = new SafetyAgent(this.provider);
  }

  async runInvestigation(input: OrchestrationInput): Promise<OrchestrationResult> {
    const startTime = Date.now();
    let totalTokens = 0;

    // 1. Triage Agent Run
    const triageRes = await this.triageAgent.run({
      scenarioCode: input.scenarioCode,
      scenarioTitle: input.scenarioTitle,
      category: input.category,
      errorLogs: input.errorLogs,
    });
    totalTokens += triageRes.totalTokens;

    await prisma.agentRun.create({
      data: {
        incidentRunId: input.incidentRunId,
        specialistRole: 'TRIAGE',
        modelIdentifier: triageRes.model,
        promptTokens: triageRes.promptTokens,
        completionTokens: triageRes.completionTokens,
        durationMs: triageRes.durationMs,
        completedAt: new Date(),
      },
    });

    // 2. Backend Agent Run
    const backendRes = await this.backendAgent.run({
      rootCause: triageRes.data.rootCauseSummary,
      sourceLocation: 'labs/commerce-lab/src/server.ts',
    });
    totalTokens += backendRes.totalTokens;

    await prisma.agentRun.create({
      data: {
        incidentRunId: input.incidentRunId,
        specialistRole: 'BACKEND',
        modelIdentifier: backendRes.model,
        promptTokens: backendRes.promptTokens,
        completionTokens: backendRes.completionTokens,
        durationMs: backendRes.durationMs,
        completedAt: new Date(),
      },
    });

    const bestCandidate = backendRes.data.candidates[1] || backendRes.data.candidates[0];
    if (!bestCandidate) {
      throw new Error('Backend agent did not produce candidate patches.');
    }

    // 3. Verification Agent Run
    const verifyRes = await this.verificationAgent.run({
      patchDiff: bestCandidate.diff,
    });
    totalTokens += verifyRes.totalTokens;

    await prisma.agentRun.create({
      data: {
        incidentRunId: input.incidentRunId,
        specialistRole: 'VERIFICATION',
        modelIdentifier: verifyRes.model,
        promptTokens: verifyRes.promptTokens,
        completionTokens: verifyRes.completionTokens,
        durationMs: verifyRes.durationMs,
        completedAt: new Date(),
      },
    });

    // 4. Safety Agent Run
    const safetyRes = await this.safetyAgent.run({
      patchDiff: bestCandidate.diff,
    });
    totalTokens += safetyRes.totalTokens;

    await prisma.agentRun.create({
      data: {
        incidentRunId: input.incidentRunId,
        specialistRole: 'SAFETY',
        modelIdentifier: safetyRes.model,
        promptTokens: safetyRes.promptTokens,
        completionTokens: safetyRes.completionTokens,
        durationMs: safetyRes.durationMs,
        completedAt: new Date(),
      },
    });

    return {
      incidentRunId: input.incidentRunId,
      rootCause: triageRes.data.rootCauseSummary,
      candidates: backendRes.data.candidates,
      verification: verifyRes.data,
      safety: safetyRes.data,
      totalTokensUsed: totalTokens,
      totalDurationMs: Date.now() - startTime,
    };
  }
}
