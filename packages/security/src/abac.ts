export interface ABACContext {
  userId: string;
  userWorkspaceIds: string[];
  targetWorkspaceId: string;
}

export interface ApprovalSeparationContext {
  candidateAuthorUserId?: string | null;
  approverUserId: string;
}

export class ABACEvaluator {
  /**
   * Enforces that the user belongs to the requested target workspace (Tenant Isolation).
   */
  static isWorkspaceAccessible(ctx: ABACContext): boolean {
    return ctx.userWorkspaceIds.includes(ctx.targetWorkspaceId);
  }

  /**
   * Enforces Separation of Duties:
   * The engineer who authored/triggered the candidate patch CANNOT be the final human approver.
   */
  static isApprovalAllowed(ctx: ApprovalSeparationContext): boolean {
    if (!ctx.candidateAuthorUserId) {
      return true; // Generated autonomously by AI without direct user authorship conflict
    }
    return ctx.candidateAuthorUserId !== ctx.approverUserId;
  }
}
