import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma, disconnectPrisma, OutboxRepository, seedDatabase } from '../index.js';
import { OutboxStatus } from '@prisma/client';

describe('Transactional Outbox Pattern Repository', () => {
  let testWorkspaceId: string;

  beforeAll(async () => {
    await seedDatabase();
    const ws = await prisma.workspace.findFirstOrThrow();
    testWorkspaceId = ws.id;
  });

  afterAll(async () => {
    await disconnectPrisma();
  });

  it('enqueues an outbox event with PENDING status', async () => {
    const event = await OutboxRepository.enqueue({
      workspaceId: testWorkspaceId,
      eventType: 'INCIDENT_CREATED',
      payload: { incidentId: 'inc-test-123', severity: 'HIGH' },
    });

    expect(event.id).toBeDefined();
    expect(event.status).toBe(OutboxStatus.PENDING);
    expect(event.eventType).toBe('INCIDENT_CREATED');
  });

  it('fetches pending batch and atomically marks them as PROCESSING', async () => {
    const batch = await OutboxRepository.fetchPendingBatch(5);
    expect(batch.length).toBeGreaterThan(0);

    const firstEvent = batch[0]!;
    expect(firstEvent.id).toBeDefined();

    // Verify status in database is now PROCESSING
    const dbEvent = await prisma.outboxEvent.findUnique({ where: { id: firstEvent.id } });
    expect(dbEvent?.status).toBe(OutboxStatus.PROCESSING);

    // Mark as published
    await OutboxRepository.markPublished(firstEvent.id);
    const publishedEvent = await prisma.outboxEvent.findUnique({ where: { id: firstEvent.id } });
    expect(publishedEvent?.status).toBe(OutboxStatus.PUBLISHED);
    expect(publishedEvent?.processedAt).toBeDefined();
  });

  it('handles failed retries and increments retry count', async () => {
    const event = await OutboxRepository.enqueue({
      workspaceId: testWorkspaceId,
      eventType: 'FAULT_INJECTION_FAILED',
      payload: { reason: 'timeout' },
    });

    await OutboxRepository.markFailed(event.id, 'Connection timeout to lab container', 3);
    const updated = await prisma.outboxEvent.findUnique({ where: { id: event.id } });
    expect(updated?.retryCount).toBe(1);
    expect(updated?.lastError).toBe('Connection timeout to lab container');
    expect(updated?.status).toBe(OutboxStatus.PENDING);
  });
});
