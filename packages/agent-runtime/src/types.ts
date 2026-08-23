import { z } from 'zod';

export const TriageOutputSchema = z.object({
  rootCauseSummary: z.string(),
  hypotheses: z.array(
    z.object({
      rank: z.number().int().min(1),
      description: z.string(),
      confidence: z.number().min(0).max(1),
      claimStatus: z.enum(['VERIFIED', 'INFERRED', 'UNVERIFIED']),
      evidenceCites: z.array(z.string()),
    }),
  ),
});
export type TriageOutput = z.infer<typeof TriageOutputSchema>;

export const CandidatePatchSchema = z.object({
  candidateId: z.string(),
  title: z.string(),
  strategy: z.string(),
  diff: z.string(),
  explanation: z.string(),
  complexity: z.enum(['LOW', 'MEDIUM', 'HIGH']),
});
export type CandidatePatch = z.infer<typeof CandidatePatchSchema>;

export const BackendOutputSchema = z.object({
  candidates: z.array(CandidatePatchSchema).min(1),
});
export type BackendOutput = z.infer<typeof BackendOutputSchema>;

export const VerificationOutputSchema = z.object({
  candidateId: z.string(),
  testPassed: z.boolean(),
  concurrencyTestPassed: z.boolean(),
  assertionLogs: z.array(z.string()),
  executionLatencyMs: z.number(),
});
export type VerificationOutput = z.infer<typeof VerificationOutputSchema>;

export const SafetyOutputSchema = z.object({
  candidateId: z.string(),
  passedSecurityPolicy: z.boolean(),
  vulnerabilitiesDetected: z.array(z.string()),
  riskScore: z.number().min(0).max(100),
  recommendation: z.enum(['APPROVE', 'REJECT', 'NEEDS_MANUAL_REVIEW']),
});
export type SafetyOutput = z.infer<typeof SafetyOutputSchema>;

export interface LLMCompletionResult<T> {
  data: T;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  durationMs: number;
  model: string;
}
