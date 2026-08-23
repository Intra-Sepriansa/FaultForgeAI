import type { FastifyError, FastifyInstance } from 'fastify';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import type { ProblemDetails } from '@faultforge/contracts';

export function setupErrorHandler(app: FastifyInstance): void {
  // 1. Handle 404 Route Not Found with RFC 7807 Problem Details
  app.setNotFoundHandler((request, reply) => {
    const traceId = request.correlationId || 'unknown';
    const problem: ProblemDetails = {
      type: 'https://faultforge.ai/errors/not-found',
      title: 'Route Not Found',
      status: 404,
      detail: `The requested endpoint '${request.method} ${request.url}' was not found.`,
      traceId,
    };
    return reply.status(404).type('application/problem+json').send(problem);
  });

  // 2. Handle Application & Validation Errors
  app.setErrorHandler((error: FastifyError, request, reply) => {
    const traceId = request.correlationId || 'unknown';

    // Handle Zod Validation Errors
    if (error instanceof ZodError) {
      const problem: ProblemDetails = {
        type: 'https://faultforge.ai/errors/validation-error',
        title: 'Validation Failed',
        status: 400,
        detail: 'The provided request payload or parameters failed validation schema checks.',
        invalidParams: error.issues.map((issue) => ({
          name: issue.path.join('.'),
          reason: issue.message,
        })),
        traceId,
      };
      return reply.status(400).type('application/problem+json').send(problem);
    }

    // Handle Prisma Known Errors
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        const target = (error.meta?.target as string[])?.join(', ') || 'resource';
        const problem: ProblemDetails = {
          type: 'https://faultforge.ai/errors/conflict',
          title: 'Resource Conflict',
          status: 409,
          detail: `A resource with the specified unique field (${target}) already exists.`,
          code: 'UNIQUE_CONSTRAINT_VIOLATION',
          traceId,
        };
        return reply.status(409).type('application/problem+json').send(problem);
      }

      if (error.code === 'P2025') {
        const problem: ProblemDetails = {
          type: 'https://faultforge.ai/errors/not-found',
          title: 'Resource Not Found',
          status: 404,
          detail: 'The requested resource was not found in the database.',
          code: 'RECORD_NOT_FOUND',
          traceId,
        };
        return reply.status(404).type('application/problem+json').send(problem);
      }
    }

    // Handle Standard Fastify HTTP Errors
    const statusCode =
      error.statusCode && error.statusCode >= 400 && error.statusCode < 600
        ? error.statusCode
        : 500;

    const problem: ProblemDetails = {
      type: `https://faultforge.ai/errors/http-${statusCode}`,
      title: error.name || 'Internal Server Error',
      status: statusCode,
      detail: statusCode === 500 ? 'An unexpected internal server error occurred.' : error.message,
      traceId,
    };

    if (statusCode === 500) {
      request.log.error({ err: error, traceId }, 'Unhandled server error');
    }

    return reply.status(statusCode).type('application/problem+json').send(problem);
  });
}
