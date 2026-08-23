import { prisma } from '@faultforge/database';
import { ABACEvaluator, hasPermission, Permission } from '@faultforge/security';
import { IncidentStatus, OrgRole } from '@prisma/client';

export interface SubmitApprovalInput {
  incidentRunId: string;
  reviewerUserId: string;
  reviewerRole: OrgRole | string;
  decision: 'APPROVED' | 'REJECTED';
  rationale: string;
  authorUserId?: string | null;
  evalCaseId?: string;
}

export class HumanApprovalGate {
  /**
   * Evaluates and records a human approval decision on an evaluated incident.
   * Strictly enforces ABAC separation of duties (no self-approval) and Reviewer/Admin permission.
   */
  static async submitDecision(input: SubmitApprovalInput) {
    const incident = await prisma.incidentRun.findUnique({
      where: { id: input.incidentRunId },
      include: {
        evalCases: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });

    if (!incident) {
      throw new Error(`Incident '${input.incidentRunId}' not found.`);
    }

    if (
      incident.status !== IncidentStatus.EVALUATED &&
      incident.status !== IncidentStatus.APPROVED
    ) {
      throw new Error(
        `Cannot submit approval for Incident '${input.incidentRunId}': Status must be 'EVALUATED', but currently '${incident.status}'.`,
      );
    }

    // Check RBAC permission for PATCH_APPROVE
    const roleEnum = input.reviewerRole as OrgRole;
    if (!hasPermission(roleEnum, Permission.PATCH_APPROVE)) {
      throw new Error(
        `Approval Gate Rejected: Role '${input.reviewerRole}' does not possess '${Permission.PATCH_APPROVE}' permission.`,
      );
    }

    // Separation of Duties check
    const isAllowed = ABACEvaluator.isApprovalAllowed({
      candidateAuthorUserId: input.authorUserId ?? null,
      approverUserId: input.reviewerUserId,
    });

    if (!isAllowed) {
      throw new Error(
        `Approval Gate Rejected: Self-approval violation. User '${input.reviewerUserId}' cannot approve a candidate patch they authored.`,
      );
    }

    const evalCaseId = input.evalCaseId || incident.evalCases[0]?.id;
    if (!evalCaseId) {
      throw new Error(`No EvaluationCase found for incident '${input.incidentRunId}'.`);
    }

    const approval = await prisma.approval.create({
      data: {
        evalCaseId,
        userId: input.reviewerUserId,
        decision: input.decision,
        comments: input.rationale,
      },
    });

    // Update incident status
    const nextStatus =
      input.decision === 'APPROVED' ? IncidentStatus.APPROVED : IncidentStatus.INVESTIGATING;

    await prisma.incidentRun.update({
      where: { id: input.incidentRunId },
      data: { status: nextStatus, updatedAt: new Date() },
    });

    return {
      success: true,
      approvalId: approval.id,
      decision: input.decision,
      incidentStatus: nextStatus,
    };
  }
}
