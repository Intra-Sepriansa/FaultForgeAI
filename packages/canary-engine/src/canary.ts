import { prisma } from '@faultforge/database';
import { RollbackEngine } from './rollback.js';
import { IncidentStatus } from '@prisma/client';

export interface CanaryStepResult {
  step: number;
  trafficPercentage: number;
  requestsEvaluated: number;
  errorRate: number;
  latencyP95Ms: number;
  isHealthy: boolean;
}

export interface CanarySimulationResult {
  incidentRunId: string;
  isSuccess: boolean;
  finalStatus: IncidentStatus;
  steps: CanaryStepResult[];
  promotedToProduction: boolean;
  rollbackTriggered: boolean;
  failureReason?: string;
}

export interface CanarySimulationOptions {
  errorRateThreshold?: number; // default 0.005 (0.5%)
  latencyThresholdMs?: number; // default 50ms
  simulateFailureAtStep?: number; // for failure-mode testing
}

export class CanarySimulator {
  /**
   * Simulates a 4-step progressive canary deployment (5% -> 25% -> 50% -> 100%).
   * Evaluates telemetry health at each step and triggers instant automated rollback on breach.
   */
  static async runSimulation(
    incidentRunId: string,
    options: CanarySimulationOptions = {},
  ): Promise<CanarySimulationResult> {
    const errorThreshold = options.errorRateThreshold ?? 0.005;
    const latencyThreshold = options.latencyThresholdMs ?? 50;

    const incident = await prisma.incidentRun.findUnique({
      where: { id: incidentRunId },
    });

    if (!incident) {
      throw new Error(`Incident '${incidentRunId}' not found.`);
    }

    if (
      incident.status !== IncidentStatus.APPROVED &&
      incident.status !== IncidentStatus.DEPLOYED_CANARY
    ) {
      throw new Error(
        `Cannot start canary simulation for Incident '${incidentRunId}': Status must be 'APPROVED', but currently '${incident.status}'.`,
      );
    }

    // Set status to DEPLOYED_CANARY
    await prisma.incidentRun.update({
      where: { id: incidentRunId },
      data: { status: IncidentStatus.DEPLOYED_CANARY, updatedAt: new Date() },
    });

    const trafficSplits = [5, 25, 50, 100];
    const steps: CanaryStepResult[] = [];

    for (let i = 0; i < trafficSplits.length; i++) {
      const stepNumber = i + 1;
      const trafficPercentage = trafficSplits[i]!;

      // Simulate step telemetry metrics
      const isForcedFailure = options.simulateFailureAtStep === stepNumber;
      const errorRate = isForcedFailure ? 0.045 : 0.001; // 4.5% if failing, 0.1% if healthy
      const latencyP95Ms = isForcedFailure ? 120 : 3.5; // 120ms if failing, 3.5ms if healthy

      const isHealthy = errorRate <= errorThreshold && latencyP95Ms <= latencyThreshold;

      const stepResult: CanaryStepResult = {
        step: stepNumber,
        trafficPercentage,
        requestsEvaluated: trafficPercentage * 20,
        errorRate,
        latencyP95Ms,
        isHealthy,
      };

      steps.push(stepResult);

      // If health telemetry breached, trigger immediate automated rollback
      if (!isHealthy) {
        const failureReason = `Canary step ${stepNumber} (${trafficPercentage}% traffic) breached health thresholds: Error rate=${(errorRate * 100).toFixed(2)}% (max ${(errorThreshold * 100).toFixed(2)}%), P95=${latencyP95Ms}ms (max ${latencyThreshold}ms).`;

        await RollbackEngine.executeRollback({
          incidentRunId,
          reason: failureReason,
          triggeredBy: 'CanaryTelemetryMonitor',
        });

        return {
          incidentRunId,
          isSuccess: false,
          finalStatus: IncidentStatus.ROLLED_BACK,
          steps,
          promotedToProduction: false,
          rollbackTriggered: true,
          failureReason,
        };
      }
    }

    // All canary steps passed healthy -> Promote to 100% and resolve incident
    await prisma.incidentRun.update({
      where: { id: incidentRunId },
      data: { status: IncidentStatus.RESOLVED, updatedAt: new Date() },
    });

    return {
      incidentRunId,
      isSuccess: true,
      finalStatus: IncidentStatus.RESOLVED,
      steps,
      promotedToProduction: true,
      rollbackTriggered: false,
    };
  }
}
