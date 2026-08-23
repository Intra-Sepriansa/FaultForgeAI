import { prisma } from '@faultforge/database';
import { DoubleBlindAnonymizer } from './anonymizer.js';
import { RubricGraderV1, type RubricEvaluationResult } from './rubric.js';
import { IncidentStatus } from '@prisma/client';

export interface CandidateToEvaluate {
  candidateId: string;
  diff: string;
  deterministicTestPassed: boolean;
  concurrencyTestPassed: boolean;
  hasSecurityFlaws: boolean;
  latencyOverheadMs: number;
  isIdempotent: boolean;
}

export interface EvaluatedCandidate {
  blindedId: string;
  alias: string;
  originalId: string;
  diff: string;
  evaluation: RubricEvaluationResult;
}

export interface ArenaEvaluationSummary {
  incidentRunId: string;
  rubricVersion: string;
  candidates: EvaluatedCandidate[];
  winningBlindedId: string;
  winningAlias: string;
}

export class ArenaEvaluator {
  /**
   * Conducts a complete double-blind evaluation of candidate patches,
   * scores them on the 100-point rubric, and persists the evaluation cases.
   */
  static async evaluateIncidentCandidates(
    incidentRunId: string,
    candidates: CandidateToEvaluate[],
  ): Promise<ArenaEvaluationSummary> {
    const session = DoubleBlindAnonymizer.anonymize(candidates);

    // 1. Create parent EvaluationCase record
    const evalCase = await prisma.evaluationCase.create({
      data: {
        incidentRunId,
        frozenInputs: {
          evaluatedAt: new Date().toISOString(),
          candidateCount: candidates.length,
          rubricVersion: RubricGraderV1.VERSION,
        },
      },
    });

    const evaluatedCandidates: EvaluatedCandidate[] = [];
    let bestCandidate: EvaluatedCandidate | null = null;
    let highestScore = -1;

    for (const blinded of session.candidates) {
      const evaluation = RubricGraderV1.evaluate({
        patchDiff: blinded.data.diff,
        deterministicTestPassed: blinded.data.deterministicTestPassed,
        concurrencyTestPassed: blinded.data.concurrencyTestPassed,
        hasSecurityFlaws: blinded.data.hasSecurityFlaws,
        latencyOverheadMs: blinded.data.latencyOverheadMs,
        isIdempotent: blinded.data.isIdempotent,
      });

      const originalId = session.unblindMap[blinded.blindedId] || blinded.blindedId;

      // 2. Persist CandidateResponse record
      await prisma.candidateResponse.create({
        data: {
          evalCaseId: evalCase.id,
          blindAlias: blinded.alias,
          modelProvider: originalId,
          patchDiff: blinded.data.diff,
          rationaleText: evaluation.disqualificationReason || 'Optimal evaluation passed.',
          isPassingTests: !evaluation.isDisqualified,
          hasSecFlaws: blinded.data.hasSecurityFlaws,
        },
      });

      const evaluatedItem: EvaluatedCandidate = {
        blindedId: blinded.blindedId,
        alias: blinded.alias,
        originalId,
        diff: blinded.data.diff,
        evaluation,
      };

      evaluatedCandidates.push(evaluatedItem);

      if (!evaluation.isDisqualified && evaluation.totalScore > highestScore) {
        highestScore = evaluation.totalScore;
        bestCandidate = evaluatedItem;
      }
    }

    // 3. Advance incident status to EVALUATED
    await prisma.incidentRun.update({
      where: { id: incidentRunId },
      data: { status: IncidentStatus.EVALUATED, updatedAt: new Date() },
    });

    const winner = bestCandidate || evaluatedCandidates[0]!;

    return {
      incidentRunId,
      rubricVersion: RubricGraderV1.VERSION,
      candidates: evaluatedCandidates,
      winningBlindedId: winner.blindedId,
      winningAlias: winner.alias,
    };
  }
}
