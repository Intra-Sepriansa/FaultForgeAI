import crypto from 'crypto';

export class PKCE {
  /**
   * Generates a cryptographically random code verifier (43-128 chars).
   */
  static generateCodeVerifier(): string {
    return crypto.randomBytes(32).toString('base64url');
  }

  /**
   * Calculates the S256 code challenge for a given code verifier.
   */
  static generateCodeChallenge(verifier: string): string {
    return crypto.createHash('sha256').update(verifier).digest('base64url');
  }

  /**
   * Verifies that a code verifier matches the expected code challenge using S256.
   */
  static verifyCodeChallenge(verifier: string, challenge: string): boolean {
    const computed = this.generateCodeChallenge(verifier);
    return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(challenge));
  }
}
