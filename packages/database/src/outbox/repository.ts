import { Prisma, OutboxStatus } from '@prisma/client';
import { prisma } from '../client.js';

export interface CreateOutboxEventParams {
  workspaceId: string;
  eventType: string;
  payload: Record<string, unknown>;
}

export class OutboxRepository {
  /**
   * Enqueues an outbox event within an existing database transaction or standalone.
   */
  static async enqueue(params: CreateOutboxEventParams, tx?: Prisma.TransactionClient) {
    const client = tx ?? prisma;
    return client.outboxEvent.create({
      data: {
        workspaceId: params.workspaceId,
        eventType: params.eventType,
        payload: params.payload as Prisma.InputJsonValue,
        status: OutboxStatus.PENDING,
      },
    });
  }

  /**
   * Fetches pending events and marks them as PROCESSING using row-level locking
   * to guarantee single-consumer processing.
   */
  static async fetchPendingBatch(limit = 10): Promise<
    Array<{
      id: string;
      workspaceId: string;
      eventType: string;
      payload: unknown;
      retryCount: number;
    }>
  > {
    return prisma.$transaction(async (tx) => {
      // Postgres-specific FOR UPDATE SKIP LOCKED
      const rawEvents = await tx.$queryRaw<
        Array<{
          id: string;
          workspace_id: string;
          event_type: string;
          payload: unknown;
          retry_count: number;
        }>
      >`
        SELECT id, workspace_id, event_type, payload, retry_count
        FROM outbox_events
        WHERE status = 'PENDING'
        ORDER BY created_at ASC
        LIMIT ${limit}
        FOR UPDATE SKIP LOCKED
      `;

      if (rawEvents.length === 0) {
        return [];
      }

      const eventIds = rawEvents.map((e) => e.id);

      await tx.outboxEvent.updateMany({
        where: { id: { in: eventIds } },
        data: { status: OutboxStatus.PROCESSING },
      });

      return rawEvents.map((e) => ({
        id: e.id,
        workspaceId: e.workspace_id,
        eventType: e.event_type,
        payload: e.payload,
        retryCount: e.retry_count,
      }));
    });
  }

  /**
   * Marks an outbox event as successfully published.
   */
  static async markPublished(eventId: string) {
    return prisma.outboxEvent.update({
      where: { id: eventId },
      data: {
        status: OutboxStatus.PUBLISHED,
        processedAt: new Date(),
      },
    });
  }

  /**
   * Marks an outbox event as failed with retry increment.
   */
  static async markFailed(eventId: string, errorMessage: string, maxRetries = 5) {
    const event = await prisma.outboxEvent.findUnique({ where: { id: eventId } });
    if (!event) return;

    const nextRetry = event.retryCount + 1;
    const isExhausted = nextRetry >= maxRetries;

    return prisma.outboxEvent.update({
      where: { id: eventId },
      data: {
        status: isExhausted ? OutboxStatus.FAILED : OutboxStatus.PENDING,
        retryCount: nextRetry,
        lastError: errorMessage,
      },
    });
  }
}
