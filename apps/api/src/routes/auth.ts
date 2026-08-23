import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { PKCE, SessionManager, AuditLogger } from '@faultforge/security';
import { prisma } from '@faultforge/database';
import { config } from '@faultforge/config';
import { requireAuth } from '../plugins/guards.js';
import { OrgRole } from '@prisma/client';

const oidcCallbackSchema = z.object({
  code: z.string(),
  codeVerifier: z.string(),
});

const mockLoginSchema = z.object({
  email: z.string().email(),
  role: z.enum(['ADMIN', 'ENGINEER', 'REVIEWER', 'VIEWER']).default('ENGINEER'),
});

export const authRoutes: FastifyPluginAsync = async (app) => {
  /**
   * Initiate OIDC Authorization Code with PKCE
   */
  app.get(
    '/login',
    {
      schema: {
        description: 'Initiate OIDC Authorization Code with PKCE',
        tags: ['Authentication'],
      },
    },
    async (_request, reply) => {
      const codeVerifier = PKCE.generateCodeVerifier();
      const codeChallenge = PKCE.generateCodeChallenge(codeVerifier);

      // Store codeVerifier in secure temporary cookie for callback exchange
      reply.setCookie('ff_pkce_verifier', codeVerifier, {
        path: '/api/v1/auth',
        httpOnly: true,
        secure: config.COOKIE_SECURE,
        sameSite: 'lax',
        maxAge: 300, // 5 minutes
      });

      const authUrl = `${config.OIDC_ISSUER_URL}?client_id=${config.OIDC_CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(config.OIDC_REDIRECT_URI)}&code_challenge=${codeChallenge}&code_challenge_method=S256`;

      return reply.send({
        authUrl,
        codeVerifierForTesting: config.NODE_ENV === 'test' ? codeVerifier : undefined,
      });
    },
  );

  /**
   * Exchange OIDC Authorization Code + PKCE verifier for session
   */
  app.post(
    '/callback',
    {
      schema: {
        description: 'Exchange OIDC Authorization Code with PKCE verifier for session',
        tags: ['Authentication'],
      },
    },
    async (request, reply) => {
      const body = oidcCallbackSchema.parse(request.body);

      // In real OIDC exchange this verifies code against OIDC token endpoint with codeVerifier.
      // For embedded local OIDC flow, we resolve mock user from code.
      const email = body.code.includes('@') ? body.code : 'engineer@faultforge.local';

      let user = await prisma.user.findUnique({
        where: { email },
        include: { memberships: true },
      });

      if (!user) {
        const org = await prisma.organization.findFirstOrThrow();
        const ws = await prisma.workspace.findFirstOrThrow();
        user = await prisma.user.create({
          data: {
            orgId: org.id,
            email,
            name: email.split('@')[0] || 'Engineer',
            memberships: {
              create: {
                workspaceId: ws.id,
                role: OrgRole.ENGINEER,
              },
            },
          },
          include: { memberships: true },
        });
      }

      const activeMembership = user.memberships[0];
      const activeWorkspaceId = activeMembership?.workspaceId || '';
      const role = activeMembership?.role || OrgRole.ENGINEER;

      const session = await SessionManager.createSession({
        userId: user.id,
        orgId: user.orgId,
        email: user.email,
        activeWorkspaceId,
        role,
      });

      reply.setCookie('ff_session', session.sessionId, {
        path: '/',
        httpOnly: true,
        secure: config.COOKIE_SECURE,
        sameSite: 'lax',
        maxAge: 86400,
      });

      return reply.send({
        success: true,
        user: { id: user.id, email: user.email, role },
        sessionId: session.sessionId,
      });
    },
  );

  /**
   * Direct Mock Login endpoint for easy local testing and development
   */
  app.post(
    '/mock-login',
    {
      schema: {
        description: 'Direct mock login for local development and testing',
        tags: ['Authentication'],
      },
    },
    async (request, reply) => {
      const body = mockLoginSchema.parse(request.body);

      // Find or create mock user & default org/workspace
      let user = await prisma.user.findUnique({
        where: { email: body.email },
        include: {
          organization: true,
          memberships: { include: { workspace: true } },
        },
      });

      if (!user) {
        let org = await prisma.organization.findFirst();
        if (!org) {
          org = await prisma.organization.create({
            data: { name: 'Acme Corp', slug: 'acme-corp' },
          });
        }

        let workspace = await prisma.workspace.findFirst({ where: { orgId: org.id } });
        if (!workspace) {
          workspace = await prisma.workspace.create({
            data: { orgId: org.id, name: 'Default Workspace', slug: 'default-workspace' },
          });
        }

        user = await prisma.user.create({
          data: {
            orgId: org.id,
            email: body.email,
            name: body.email.split('@')[0] || 'User',
            memberships: {
              create: {
                workspaceId: workspace.id,
                role: body.role as OrgRole,
              },
            },
          },
          include: {
            organization: true,
            memberships: { include: { workspace: true } },
          },
        });
      }

      const activeMembership = user.memberships[0];
      const activeWorkspaceId = activeMembership?.workspaceId || '';
      const role = activeMembership?.role || (body.role as OrgRole);

      // Create session in Redis
      const session = await SessionManager.createSession({
        userId: user.id,
        orgId: user.orgId,
        email: user.email,
        activeWorkspaceId,
        role,
      });

      // Set HttpOnly, Secure opaque session cookie
      reply.setCookie('ff_session', session.sessionId, {
        path: '/',
        httpOnly: true,
        secure: config.COOKIE_SECURE,
        sameSite: 'lax',
        maxAge: 86400, // 24 hours
      });

      if (activeWorkspaceId) {
        await AuditLogger.record({
          workspaceId: activeWorkspaceId,
          userId: user.id,
          action: 'USER_LOGIN',
          resourceType: 'SESSION',
          resourceId: session.sessionId,
          metadata: { email: user.email, role },
          ipAddress: request.ip,
        });
      }

      return reply.send({
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role,
          activeWorkspaceId,
        },
        sessionId: session.sessionId,
      });
    },
  );

  /**
   * Introspect current authenticated user & active workspace
   */
  app.get(
    '/me',
    {
      preHandler: requireAuth(),
      schema: {
        description: 'Get current authenticated user details and active session info',
        tags: ['Authentication'],
      },
    },
    async (request, reply) => {
      if (!request.user) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const userDetails = await prisma.user.findUnique({
        where: { id: request.user.id },
        select: {
          id: true,
          email: true,
          name: true,
          organization: { select: { id: true, name: true, slug: true } },
          memberships: {
            select: {
              role: true,
              workspace: { select: { id: true, name: true, slug: true } },
            },
          },
        },
      });

      return reply.send({
        user: userDetails,
        activeSession: request.session,
      });
    },
  );

  /**
   * Logout and revoke session
   */
  app.post(
    '/logout',
    {
      preHandler: requireAuth(),
      schema: {
        description: 'Logout user and revoke Redis session',
        tags: ['Authentication'],
      },
    },
    async (request, reply) => {
      if (request.session) {
        await SessionManager.destroySession(request.session.sessionId);

        if (request.session.activeWorkspaceId) {
          await AuditLogger.record({
            workspaceId: request.session.activeWorkspaceId,
            userId: request.session.userId,
            action: 'USER_LOGOUT',
            resourceType: 'SESSION',
            resourceId: request.session.sessionId,
            metadata: { email: request.session.email },
            ipAddress: request.ip,
          });
        }
      }

      reply.clearCookie('ff_session', { path: '/' });
      return reply.send({ success: true, message: 'Logged out successfully' });
    },
  );
};
