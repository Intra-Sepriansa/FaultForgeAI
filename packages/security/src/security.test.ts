import { describe, it, expect, afterAll } from 'vitest';
import {
  hasPermission,
  Permission,
  ABACEvaluator,
  SecretRedactor,
  PKCE,
  SessionManager,
} from './index.js';
import { OrgRole } from '@prisma/client';
import { disconnectRedis } from '@faultforge/database';

describe('Security Package Unit & Integration Tests', () => {
  afterAll(async () => {
    await disconnectRedis();
  });

  describe('RBAC Role & Permission Matrix', () => {
    it('grants all permissions to OWNER', () => {
      expect(hasPermission(OrgRole.OWNER, Permission.PATCH_APPROVE)).toBe(true);
      expect(hasPermission(OrgRole.OWNER, Permission.MEMBER_MANAGE)).toBe(true);
    });

    it('allows REVIEWER to approve patches but prevents member management', () => {
      expect(hasPermission(OrgRole.REVIEWER, Permission.PATCH_APPROVE)).toBe(true);
      expect(hasPermission(OrgRole.REVIEWER, Permission.MEMBER_MANAGE)).toBe(false);
    });

    it('prevents ENGINEER from approving patches or canary deployments', () => {
      expect(hasPermission(OrgRole.ENGINEER, Permission.INCIDENT_INJECT)).toBe(true);
      expect(hasPermission(OrgRole.ENGINEER, Permission.PATCH_APPROVE)).toBe(false);
      expect(hasPermission(OrgRole.ENGINEER, Permission.CANARY_DEPLOY)).toBe(false);
    });
  });

  describe('ABAC Policy & Separation of Duties', () => {
    it('blocks approval if candidate author is the same as approver', () => {
      const allowed = ABACEvaluator.isApprovalAllowed({
        candidateAuthorUserId: 'user-alice-123',
        approverUserId: 'user-alice-123',
      });
      expect(allowed).toBe(false);
    });

    it('allows approval when approver is a different user', () => {
      const allowed = ABACEvaluator.isApprovalAllowed({
        candidateAuthorUserId: 'user-alice-123',
        approverUserId: 'user-bob-456',
      });
      expect(allowed).toBe(true);
    });

    it('enforces tenant workspace boundaries', () => {
      const isAllowed = ABACEvaluator.isWorkspaceAccessible({
        userId: 'user-1',
        userWorkspaceIds: ['ws-1', 'ws-2'],
        targetWorkspaceId: 'ws-3',
      });
      expect(isAllowed).toBe(false);
    });
  });

  describe('Secret Redactor Utility', () => {
    it('redacts sensitive values in nested objects', () => {
      const payload = {
        name: 'Test Run',
        databasePassword: 'super_secret_db_password',
        auth: {
          apiKey: 'sk-123456789012345678901234567890123456789012345678',
          token: 'bearer my_jwt_token',
        },
        publicInfo: 'safe_data',
      };

      const sanitized = SecretRedactor.redactObject(payload);
      expect(sanitized.databasePassword).toBe('[REDACTED]');
      expect(sanitized.auth.apiKey).toBe('[REDACTED]');
      expect(sanitized.auth.token).toBe('[REDACTED]');
      expect(sanitized.publicInfo).toBe('safe_data');
    });

    it('redacts tokens embedded in raw text', () => {
      const rawLog = 'Error connecting with postgres://user:mypassword123@localhost:5432/db';
      const redacted = SecretRedactor.redactString(rawLog);
      expect(redacted).not.toContain('mypassword123');
      expect(redacted).toContain('[REDACTED_SECRET]');
    });
  });

  describe('PKCE RFC 7636 Utilities', () => {
    it('generates matching S256 challenge for code verifier', () => {
      const verifier = PKCE.generateCodeVerifier();
      const challenge = PKCE.generateCodeChallenge(verifier);
      expect(PKCE.verifyCodeChallenge(verifier, challenge)).toBe(true);
    });

    it('rejects tampered code verifier', () => {
      const verifier = PKCE.generateCodeVerifier();
      const challenge = PKCE.generateCodeChallenge(verifier);
      expect(PKCE.verifyCodeChallenge(verifier + 'tampered', challenge)).toBe(false);
    });
  });

  describe('Redis Session Manager Lifecycle', () => {
    it('creates, retrieves, rotates, and destroys session', async () => {
      const session = await SessionManager.createSession({
        userId: 'user-test-01',
        orgId: 'org-test-01',
        email: 'test@faultforge.local',
        activeWorkspaceId: 'ws-test-01',
        role: OrgRole.ENGINEER,
      });

      expect(session.sessionId).toBeDefined();

      // Retrieve
      const fetched = await SessionManager.getSession(session.sessionId);
      expect(fetched?.email).toBe('test@faultforge.local');

      // Rotate session ID
      const rotated = await SessionManager.rotateSession(session.sessionId);
      expect(rotated).not.toBeNull();
      expect(rotated?.sessionId).not.toBe(session.sessionId);
      expect(rotated?.userId).toBe('user-test-01');

      // Old session must be destroyed
      const oldSession = await SessionManager.getSession(session.sessionId);
      expect(oldSession).toBeNull();

      // Destroy rotated session
      if (rotated) {
        await SessionManager.destroySession(rotated.sessionId);
        const destroyed = await SessionManager.getSession(rotated.sessionId);
        expect(destroyed).toBeNull();
      }
    });
  });
});
