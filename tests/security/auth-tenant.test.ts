import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildServer } from '../../apps/api/src/server.js';
import { disconnectPrisma, disconnectRedis, seedDatabase, prisma } from '@faultforge/database';

describe('Security & Multi-Tenancy Integration Tests', () => {
  let app: FastifyInstance;
  let adminCookie: string;
  let reviewerCookie: string;
  let primaryWorkspaceId: string;

  beforeAll(async () => {
    app = await buildServer();
    await app.ready();
    await seedDatabase();

    const ws = await prisma.workspace.findFirstOrThrow();
    primaryWorkspaceId = ws.id;

    // Login as Admin
    const adminRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/mock-login',
      payload: { email: 'admin@faultforge.local', role: 'ADMIN' },
    });
    expect(adminRes.statusCode).toBe(200);
    const setCookie = adminRes.headers['set-cookie'] as string;
    adminCookie = setCookie.split(';')[0]!;

    // Login as Reviewer
    const revRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/mock-login',
      payload: { email: 'reviewer@faultforge.local', role: 'REVIEWER' },
    });
    expect(revRes.statusCode).toBe(200);
    const revSetCookie = revRes.headers['set-cookie'] as string;
    reviewerCookie = revSetCookie.split(';')[0]!;
  });

  afterAll(async () => {
    await app.close();
    await disconnectPrisma();
    await disconnectRedis();
  });

  it('GET /api/v1/auth/me returns 401 when unauthenticated', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
    });

    expect(response.statusCode).toBe(401);
    const body = JSON.parse(response.body);
    expect(body.title).toBe('Unauthorized');
  });

  it('GET /api/v1/auth/me returns user profile and workspace when session cookie is provided', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: {
        cookie: adminCookie,
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.user.email).toBe('admin@faultforge.local');
    expect(body.activeSession.role).toBe('ADMIN');
  });

  it('GET /api/v1/auth/me differentiates reviewer role', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: {
        cookie: reviewerCookie,
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.user.email).toBe('reviewer@faultforge.local');
    expect(body.activeSession.role).toBe('REVIEWER');
  });

  it('GET /api/v1/auth/login initiates PKCE authorization flow', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/login',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.authUrl).toContain('code_challenge=');
    expect(body.authUrl).toContain('code_challenge_method=S256');
    expect(response.headers['set-cookie']).toBeDefined();
  });

  it('POST /api/v1/auth/callback exchanges code for session', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/callback',
      payload: {
        code: 'engineer-oidc@faultforge.local',
        codeVerifier: 'mock_pkce_verifier_string_that_is_long_enough',
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(true);
    expect(body.user.email).toBe('engineer-oidc@faultforge.local');
  });

  it('POST /api/v1/auth/logout revokes session and clears cookie', async () => {
    // Login temporary user
    const tempRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/mock-login',
      payload: { email: 'temp-user@faultforge.local', role: 'VIEWER' },
    });
    const tempCookie = (tempRes.headers['set-cookie'] as string).split(';')[0]!;

    // Logout
    const logoutRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/logout',
      headers: { cookie: tempCookie },
    });
    expect(logoutRes.statusCode).toBe(200);

    // Verify session is revoked
    const checkRes = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: { cookie: tempCookie },
    });
    expect(checkRes.statusCode).toBe(401);
  });

  it('records audit events with correct workspace id in database', async () => {
    const auditLogs = await prisma.auditEvent.findMany({
      where: {
        workspaceId: primaryWorkspaceId,
        action: { in: ['USER_LOGIN', 'USER_LOGOUT'] },
      },
      orderBy: { occurredAt: 'desc' },
      take: 5,
    });

    expect(auditLogs.length).toBeGreaterThan(0);
    expect(auditLogs[0]?.action).toBeDefined();
  });
});
