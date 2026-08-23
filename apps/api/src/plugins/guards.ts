import type { FastifyRequest, FastifyReply } from 'fastify';
import { hasPermission, type Permission } from '@faultforge/security';
import { prisma } from '@faultforge/database';

export function requireAuth() {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const authenticate = (request.server as any).authenticate;
    if (authenticate) {
      await authenticate(request, reply);
    }
  };
}

export function requirePermission(permission: Permission) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const authenticate = (request.server as any).authenticate;
    if (authenticate) {
      await authenticate(request, reply);
      if (reply.sent) return;
    }

    if (!request.user || !hasPermission(request.user.role, permission)) {
      return reply
        .status(403)
        .type('application/problem+json')
        .send({
          type: 'https://faultforge.ai/errors/forbidden',
          title: 'Forbidden',
          status: 403,
          detail: `User role '${request.user?.role}' does not possess required permission '${permission}'.`,
          traceId: request.correlationId,
        });
    }
  };
}

export function requireWorkspaceMember() {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const authenticate = (request.server as any).authenticate;
    if (authenticate) {
      await authenticate(request, reply);
      if (reply.sent) return;
    }

    const { workspaceId } = request.params as { workspaceId?: string };
    if (!workspaceId || !request.user) return;

    const membership = await prisma.membership.findUnique({
      where: {
        userId_workspaceId: {
          userId: request.user.id,
          workspaceId,
        },
      },
    });

    if (!membership) {
      return reply.status(403).type('application/problem+json').send({
        type: 'https://faultforge.ai/errors/tenant-isolation-violation',
        title: 'Workspace Access Denied',
        status: 403,
        detail: 'You are not a member of the requested tenant workspace.',
        traceId: request.correlationId,
      });
    }
  };
}
