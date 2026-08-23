import { SecretRedactor } from '@faultforge/security';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export interface LogContext {
  traceId?: string;
  spanId?: string;
  tenantId?: string;
  incidentId?: string;
  userId?: string;
  [key: string]: unknown;
}

export class Logger {
  private serviceName: string;

  constructor(serviceName = 'faultforge-platform') {
    this.serviceName = serviceName;
  }

  private log(level: LogLevel, message: string, context?: LogContext): void {
    const rawPayload = {
      service: this.serviceName,
      level,
      timestamp: new Date().toISOString(),
      message,
      ...(context || {}),
    };

    // Auto-redact secrets from structured logs before printing
    const sanitizedPayload = SecretRedactor.redactObject(rawPayload);
    const jsonOutput = JSON.stringify(sanitizedPayload);

    if (level === 'error' || level === 'fatal') {
      console.error(jsonOutput);
    } else if (level === 'warn') {
      console.warn(jsonOutput);
    } else {
      console.info(jsonOutput);
    }
  }

  debug(message: string, context?: LogContext): void {
    this.log('debug', message, context);
  }

  info(message: string, context?: LogContext): void {
    this.log('info', message, context);
  }

  warn(message: string, context?: LogContext): void {
    this.log('warn', message, context);
  }

  error(message: string, context?: LogContext): void {
    this.log('error', message, context);
  }

  fatal(message: string, context?: LogContext): void {
    this.log('fatal', message, context);
  }
}

export const logger = new Logger();
