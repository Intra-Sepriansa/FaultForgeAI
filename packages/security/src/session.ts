import crypto from 'crypto';
import { redis } from '@faultforge/database';
import type { OrgRole } from '@prisma/client';

export interface UserSession {
  sessionId: string;
  userId: string;
  orgId: string;
  email: string;
  activeWorkspaceId: string;
  role: OrgRole;
  createdAt: string;
  lastActiveAt: string;
}

const SESSION_TTL_SECONDS = 86400; // 24 hours
const SESSION_PREFIX = 'ff_sess:';

export class SessionManager {
  private static getKey(sessionId: string): string {
    return `${SESSION_PREFIX}${sessionId}`;
  }

  /**
   * Creates a new opaque session in Redis with 24-hour expiration.
   */
  static async createSession(
    data: Omit<UserSession, 'sessionId' | 'createdAt' | 'lastActiveAt'>,
  ): Promise<UserSession> {
    const sessionId = crypto.randomBytes(32).toString('hex');
    const now = new Date().toISOString();

    const session: UserSession = {
      ...data,
      sessionId,
      createdAt: now,
      lastActiveAt: now,
    };

    await redis.set(this.getKey(sessionId), JSON.stringify(session), 'EX', SESSION_TTL_SECONDS);

    return session;
  }

  /**
   * Retrieves an active session from Redis and updates lastActiveAt timestamp.
   */
  static async getSession(sessionId: string): Promise<UserSession | null> {
    const raw = await redis.get(this.getKey(sessionId));
    if (!raw) return null;

    try {
      const session: UserSession = JSON.parse(raw);
      session.lastActiveAt = new Date().toISOString();
      await redis.set(this.getKey(sessionId), JSON.stringify(session), 'KEEPTTL');
      return session;
    } catch {
      return null;
    }
  }

  /**
   * Rotates an existing session ID to prevent session fixation attacks.
   */
  static async rotateSession(oldSessionId: string): Promise<UserSession | null> {
    const existing = await this.getSession(oldSessionId);
    if (!existing) return null;

    await this.destroySession(oldSessionId);
    return this.createSession({
      userId: existing.userId,
      orgId: existing.orgId,
      email: existing.email,
      activeWorkspaceId: existing.activeWorkspaceId,
      role: existing.role,
    });
  }

  /**
   * Destroys a session on logout or revocation.
   */
  static async destroySession(sessionId: string): Promise<void> {
    await redis.del(this.getKey(sessionId));
  }
}
