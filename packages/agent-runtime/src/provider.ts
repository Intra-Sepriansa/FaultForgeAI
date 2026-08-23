import type { z } from 'zod';
import type {
  LLMCompletionResult,
  TriageOutput,
  BackendOutput,
  VerificationOutput,
  SafetyOutput,
} from './types.js';

export interface LLMProvider {
  completeStructured<T>(
    prompt: string,
    schema: z.ZodType<T>,
    options?: { model?: string; maxTokens?: number; temperature?: number },
  ): Promise<LLMCompletionResult<T>>;
}

export class MockDeterministicLLMProvider implements LLMProvider {
  private modelName: string;

  constructor(modelName = 'faultforge-deepseek-r1-mock') {
    this.modelName = modelName;
  }

  async completeStructured<T>(
    prompt: string,
    _schema: z.ZodType<T>,
    _options?: { model?: string; maxTokens?: number; temperature?: number },
  ): Promise<LLMCompletionResult<T>> {
    const startTime = Date.now();
    const promptLength = prompt.length;
    const promptTokens = Math.max(50, Math.floor(promptLength / 4));

    let data: unknown;

    if (prompt.includes('TRIAGE_AGENT')) {
      const triageData: TriageOutput = {
        rootCauseSummary:
          'Concurrent read-then-write non-atomic sequence in checkout handler allows overselling under race condition.',
        hypotheses: [
          {
            rank: 1,
            description:
              'Time-of-check to time-of-use (TOCTOU) gap in stock deduction logic allows multiple parallel requests to pass stock availability check before decrement.',
            confidence: 0.96,
            claimStatus: 'VERIFIED',
            evidenceCites: ['trace-span-checkout-402', 'log-stock-discrepancy-01'],
          },
          {
            rank: 2,
            description: 'Stale cached read from Redis replica without write invalidation.',
            confidence: 0.25,
            claimStatus: 'UNVERIFIED',
            evidenceCites: [],
          },
        ],
      };
      data = triageData;
    } else if (prompt.includes('BACKEND_AGENT')) {
      const backendData: BackendOutput = {
        candidates: [
          {
            candidateId: 'cand-mutex-a',
            title: 'In-memory Mutex Lock Wrapper',
            strategy: 'MUTEX_SERIALIZATION',
            complexity: 'LOW',
            diff: `--- a/labs/commerce-lab/src/server.ts\n+++ b/labs/commerce-lab/src/server.ts\n@@ -20,6 +20,10 @@\n+  await mutex.acquire();\n+  try {\n     store.unsafeSetStock(productId, currentStock - 1);\n+  } finally { mutex.release(); }`,
            explanation:
              'Wraps checkout logic with an asynchronous Mutex lock. Prevents overselling but limits throughput to single-threaded processing.',
          },
          {
            candidateId: 'cand-atomic-b',
            title: 'Atomic SQL Conditional Decrement',
            strategy: 'ATOMIC_CONDITIONAL_DECREMENT',
            complexity: 'MEDIUM',
            diff: `--- a/labs/commerce-lab/src/server.ts\n+++ b/labs/commerce-lab/src/server.ts\n@@ -25,7 +25,7 @@\n-  store.unsafeSetStock(productId, currentStock - 1);\n+  const success = store.atomicDecrementStock(productId, 1);\n+  if (!success) return reply.status(409).send({ error: 'Out of stock' });`,
            explanation:
              'Executes atomic decrement at storage level with WHERE stock >= 1 predicate. Maximum throughput, zero concurrency race condition.',
          },
        ],
      };
      data = backendData;
    } else if (prompt.includes('VERIFICATION_AGENT')) {
      const verificationData: VerificationOutput = {
        candidateId: 'cand-atomic-b',
        testPassed: true,
        concurrencyTestPassed: true,
        assertionLogs: [
          '[PASS] Single item concurrent checkout with 20 parallel requests: Exactly 5 succeeded, 15 returned 409 Conflict',
          '[PASS] Final stock count strictly equals 0',
          '[PASS] Latency P99 measured at 2.1ms',
        ],
        executionLatencyMs: 45,
      };
      data = verificationData;
    } else if (prompt.includes('SAFETY_AGENT')) {
      const safetyData: SafetyOutput = {
        candidateId: 'cand-atomic-b',
        passedSecurityPolicy: true,
        vulnerabilitiesDetected: [],
        riskScore: 5,
        recommendation: 'APPROVE',
      };
      data = safetyData;
    } else {
      data = { message: 'Default structured response' };
    }

    const completionTokens = Math.max(80, Math.floor(JSON.stringify(data).length / 4));

    return {
      data: data as T,
      promptTokens,
      completionTokens,
      totalTokens: promptTokens + completionTokens,
      durationMs: Date.now() - startTime + 5,
      model: this.modelName,
    };
  }
}
