import { IncidentStatus } from '@prisma/client';
import { prisma, Prisma } from '@faultforge/database';

export const ALLOWED_TRANSITIONS: Record<IncidentStatus, ReadonlySet<IncidentStatus>> = {
  [IncidentStatus.INITIATED]: new Set([IncidentStatus.FAULT_INJECTED]),
  [IncidentStatus.FAULT_INJECTED]: new Set([IncidentStatus.INVESTIGATING, IncidentStatus.RESOLVED]),
  [IncidentStatus.INVESTIGATING]: new Set([IncidentStatus.REPRODUCED, IncidentStatus.RESOLVED]),
  [IncidentStatus.REPRODUCED]: new Set([
    IncidentStatus.SOLUTIONS_GENERATED,
    IncidentStatus.INVESTIGATING,
  ]),
  [IncidentStatus.SOLUTIONS_GENERATED]: new Set([
    IncidentStatus.EVALUATED,
    IncidentStatus.REPRODUCED,
  ]),
  [IncidentStatus.EVALUATED]: new Set([IncidentStatus.APPROVED, IncidentStatus.INVESTIGATING]),
  [IncidentStatus.APPROVED]: new Set([IncidentStatus.DEPLOYED_CANARY, IncidentStatus.ROLLED_BACK]),
  [IncidentStatus.DEPLOYED_CANARY]: new Set([IncidentStatus.RESOLVED, IncidentStatus.ROLLED_BACK]),
  [IncidentStatus.RESOLVED]: new Set([IncidentStatus.INITIATED]), // Can be replayed/reopened
  [IncidentStatus.ROLLED_BACK]: new Set([IncidentStatus.INVESTIGATING, IncidentStatus.RESOLVED]),
};

export class IncidentStateMachine {
  /**
   * Verifies if a state transition is valid according to lifecycle rules.
   */
  static isValidTransition(current: IncidentStatus, next: IncidentStatus): boolean {
    if (current === next) return true;
    const allowed = ALLOWED_TRANSITIONS[current];
    return allowed ? allowed.has(next) : false;
  }

  /**
   * Atomically transitions an incident to the next state in the database,
   * throwing an error if the transition violates lifecycle rules.
   */
  static async transition(incidentId: string, nextState: IncidentStatus) {
    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const incident = await tx.incidentRun.findUnique({
        where: { id: incidentId },
      });

      if (!incident) {
        throw new Error(`Incident '${incidentId}' not found.`);
      }

      if (!this.isValidTransition(incident.status, nextState)) {
        throw new Error(
          `Illegal state transition for Incident '${incidentId}': Cannot transition from '${incident.status}' to '${nextState}'.`,
        );
      }

      return tx.incidentRun.update({
        where: { id: incidentId },
        data: { status: nextState, updatedAt: new Date() },
      });
    });
  }
}
