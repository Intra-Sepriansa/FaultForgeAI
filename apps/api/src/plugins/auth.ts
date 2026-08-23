import fp from 'fastify-plugin';
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { SessionManager, type UserSession } from '@faultforge/security';

declare module 'fastify' {
  interface FastifyRequest {
    session?: UserSession;
    user?: {
      id: string;
      orgId: string;
      email: string;
      activeWorkspaceId: string;
      role: UserSession['role'];
    };
  }
}

const authPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.decorate('authenticate', async (request: FastifyRequest, reply: FastifyReply) => {
    // 1. Check opaque session cookie
    let sessionId = request.cookies['ff_session'];

    // 2. Or check Authorization: Bearer <sessionId>
    if (!sessionId && request.headers.authorization) {
      const parts = request.headers.authorization.split(' ');
      if (parts.length === 2 && parts[0] === 'Bearer') {
        sessionId = parts[1];
      }
    }

    if (!sessionId) {
      return reply.status(401).type('application/problem+json').send({
        type: 'https://faultforge.ai/errors/unauthorized',
        title: 'Unauthorized',
        status: 401,
        detail:
          'Authentication is required to access this resource. Missing or invalid session cookie.',
        traceId: request.correlationId,
      });
    }

    const session = await SessionManager.getSession(sessionId);
    if (!session) {
      return reply.status(401).type('application/problem+json').send({
        type: 'https://faultforge.ai/errors/unauthorized',
        title: 'Session Expired or Revoked',
        status: 401,
        detail: 'The provided session identifier is invalid, expired, or revoked.',
        traceId: request.correlationId,
      });
    }

    request.session = session;
    request.user = {
      id: session.userId,
      orgId: session.orgId,
      email: session.email,
      activeWorkspaceId: session.activeWorkspaceId,
      role: session.role,
    };
  });
};

export default fp(authPlugin, {
  name: 'auth-plugin',
});
