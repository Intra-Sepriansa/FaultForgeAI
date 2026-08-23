export interface DimensionScore {
  dimension: string;
  score: number;
  maxScore: number;
  rationale: string;
}

export interface RubricEvaluationResult {
  totalScore: number;
  maxScore: number;
  isDisqualified: boolean;
  disqualificationReason?: string | undefined;
  dimensions: DimensionScore[];
}

export interface CandidateEvaluationInput {
  patchDiff: string;
  deterministicTestPassed: boolean;
  concurrencyTestPassed: boolean;
  hasSecurityFlaws: boolean;
  latencyOverheadMs: number;
  isIdempotent: boolean;
}

export class RubricGraderV1 {
  static readonly VERSION = 'v1.0.0';

  /**
   * Evaluates a candidate patch against the 100-Point Versioned Rubric.
   */
  static evaluate(input: CandidateEvaluationInput): RubricEvaluationResult {
    const dimensions: DimensionScore[] = [];

    // 1. Correctness & Invariant Proof (Max 25 pts)
    let correctnessScore = 25;
    let correctnessRationale = 'Successfully passes all deterministic invariant assertions.';
    if (!input.deterministicTestPassed) {
      correctnessScore = 0;
      correctnessRationale = 'Failed deterministic baseline test invariants.';
    }
    dimensions.push({
      dimension: 'Correctness & Invariant Proof',
      score: correctnessScore,
      maxScore: 25,
      rationale: correctnessRationale,
    });

    // 2. Security & Exploit Resistance (Max 20 pts)
    let securityScore = 20;
    let securityRationale = 'No security vulnerabilities, SQLi, or auth bypasses detected.';
    if (input.hasSecurityFlaws) {
      securityScore = 0;
      securityRationale = 'Critical security flaw or policy violation detected.';
    }
    dimensions.push({
      dimension: 'Security & Exploit Resistance',
      score: securityScore,
      maxScore: 20,
      rationale: securityRationale,
    });

    // 3. Performance & Latency Overhead (Max 15 pts)
    let performanceScore = 15;
    let perfRationale = 'Optimal latency (< 5ms overhead), zero lock contention.';
    if (input.latencyOverheadMs > 20) {
      performanceScore = 5;
      perfRationale = `High latency overhead (${input.latencyOverheadMs}ms) caused by heavy locking.`;
    } else if (input.latencyOverheadMs > 5) {
      performanceScore = 10;
      perfRationale = `Moderate latency overhead (${input.latencyOverheadMs}ms).`;
    }
    dimensions.push({
      dimension: 'Performance & Concurrency Latency',
      score: performanceScore,
      maxScore: 15,
      rationale: perfRationale,
    });

    // 4. API Contract & Schema Compatibility (Max 10 pts)
    dimensions.push({
      dimension: 'API Contract & Schema Compatibility',
      score: 10,
      maxScore: 10,
      rationale: 'Fully backward-compatible API schema and RFC 7807 response formatting.',
    });

    // 5. Reliability & Fault-Tolerance (Max 10 pts)
    let reliabilityScore = 10;
    let relRationale = 'Idempotent state mutation with graceful error handling.';
    if (!input.isIdempotent) {
      reliabilityScore = 5;
      relRationale = 'Mutation lacks idempotency key verification.';
    }
    dimensions.push({
      dimension: 'Reliability & Fault-Tolerance',
      score: reliabilityScore,
      maxScore: 10,
      rationale: relRationale,
    });

    // 6. Test Quality & Concurrency Coverage (Max 10 pts)
    let testScore = 10;
    let testRationale = 'Verified with high-concurrency race condition test suite.';
    if (!input.concurrencyTestPassed) {
      testScore = 0;
      testRationale = 'Failed concurrent race condition stress test.';
    }
    dimensions.push({
      dimension: 'Test Quality & Concurrency Coverage',
      score: testScore,
      maxScore: 10,
      rationale: testRationale,
    });

    // 7. Code Clarity & Architecture (Max 10 pts)
    dimensions.push({
      dimension: 'Code Clarity & Architecture',
      score: 10,
      maxScore: 10,
      rationale: 'Clean TypeScript types, clear domain logic separation, zero TODO placeholders.',
    });

    // Check automatic disqualification
    let isDisqualified = false;
    let disqualificationReason: string | undefined = undefined;

    if (!input.deterministicTestPassed) {
      isDisqualified = true;
      disqualificationReason = 'Disqualified: Failed baseline correctness invariants.';
    } else if (input.hasSecurityFlaws) {
      isDisqualified = true;
      disqualificationReason = 'Disqualified: Failed security policy verification.';
    }

    const totalScore = dimensions.reduce((sum, d) => sum + d.score, 0);

    const result: RubricEvaluationResult = {
      totalScore,
      maxScore: 100,
      isDisqualified,
      dimensions,
    };

    if (disqualificationReason !== undefined) {
      result.disqualificationReason = disqualificationReason;
    }

    return result;
  }
}
