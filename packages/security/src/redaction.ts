const SENSITIVE_KEY_PATTERNS = [
  /password/i,
  /secret/i,
  /token/i,
  /api[_-]?key/i,
  /authorization/i,
  /cookie/i,
  /private[_-]?key/i,
];

const SECRET_VALUE_PATTERNS = [
  /bearer\s+[a-zA-Z0-9_\-.]+/gi,
  /ghp_[a-zA-Z0-9]{36}/gi,
  /sk-[a-zA-Z0-9]{48}/gi,
  /postgres:\/\/[^:]+:([^@]+)@/gi,
  /redis:\/\/:([^@]+)@/gi,
];

export class SecretRedactor {
  /**
   * Redacts matching secrets in raw string content.
   */
  static redactString(input: string): string {
    let result = input;
    for (const pattern of SECRET_VALUE_PATTERNS) {
      result = result.replace(pattern, '[REDACTED_SECRET]');
    }
    return result;
  }

  /**
   * Recursively sanitizes any object or array, masking values associated with sensitive keys.
   */
  static redactObject<T>(obj: T): T {
    if (obj === null || typeof obj !== 'object') {
      if (typeof obj === 'string') {
        return this.redactString(obj) as unknown as T;
      }
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => this.redactObject(item)) as unknown as T;
    }

    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      const isSensitiveKey = SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(key));
      if (isSensitiveKey && typeof value === 'string') {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = this.redactObject(value);
      }
    }

    return sanitized as T;
  }
}
