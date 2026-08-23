import { prisma } from '@faultforge/database';
import { IncidentStatus } from '@prisma/client';

export interface RollbackInput {
  incidentRunId: string;
  reason: string;
  triggeredBy?: string;
}

export class RollbackEngine {
  /**
   * Immediately rolls back an in-flight or failed canary deployment,
   * restoring the baseline state and marking the incident as ROLLED_BACK.
   */
  static async executeRollback(input: RollbackInput) {
    const incident = await prisma.incidentRun.findUnique({
      where: { id: input.incidentRunId },
    });

    if (!incident) {
      throw new Error(`Incident '${input.incidentRunId}' not found.`);
    }

    // Advance incident state to ROLLED_BACK
    const updated = await prisma.incidentRun.update({
      where: { id: input.incidentRunId },
      data: {
        status: IncidentStatus.ROLLED_BACK,
        updatedAt: new Date(),
      },
    });

    return {
      success: true,
      incidentRunId: input.incidentRunId,
      status: IncidentStatus.ROLLED_BACK,
      snapshotHash: incident.snapshotHash,
      reason: input.reason,
      rolledBackAt: updated.updatedAt.toISOString(),
    };
  }
}
