import { prisma } from '@faultforge/database';
import { Prisma } from '@prisma/client';

export interface RecordAuditEventParams {
  workspaceId: string;
  userId?: string | null;
  action: string;
  resourceType: string;
  resourceId: string;
  metadata: Record<string, unknown>;
  ipAddress?: string | null;
}

export class AuditLogger {
  /**
   * Records an immutable audit event for security and governance tracking.
   */
  static async record(params: RecordAuditEventParams) {
    return prisma.auditEvent.create({
      data: {
        workspaceId: params.workspaceId,
        userId: params.userId ?? null,
        action: params.action,
        resourceType: params.resourceType,
        resourceId: params.resourceId,
        metadata: params.metadata as Prisma.InputJsonValue,
        ipAddress: params.ipAddress ?? null,
      },
    });
  }
}
