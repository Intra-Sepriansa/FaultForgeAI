import { OutboxRepository } from '@faultforge/database';
import { incidentQueue } from '../queues.js';

export class OutboxPoller {
  private isRunning = false;
  private intervalTimer: NodeJS.Timeout | null = null;

  /**
   * Processes a single batch of pending outbox events.
   */
  async processBatch(): Promise<number> {
    const events = await OutboxRepository.fetchPendingBatch(10);
    if (events.length === 0) return 0;

    for (const evt of events) {
      try {
        // Enqueue into BullMQ with deterministic jobId for deduplication
        await incidentQueue.add(
          evt.eventType,
          {
            outboxEventId: evt.id,
            workspaceId: evt.workspaceId,
            eventType: evt.eventType,
            payload: evt.payload,
          },
          {
            jobId: `outbox-${evt.id}`, // Guarantees idempotent dispatching
          },
        );

        await OutboxRepository.markPublished(evt.id);
      } catch (error) {
        await OutboxRepository.markFailed(evt.id, (error as Error).message);
      }
    }

    return events.length;
  }

  /**
   * Starts periodic polling every intervalMs.
   */
  start(intervalMs = 1000): void {
    if (this.isRunning) return;
    this.isRunning = true;

    const poll = async () => {
      if (!this.isRunning) return;
      try {
        await this.processBatch();
      } catch (err) {
        console.error('[Outbox Poller] Error processing batch:', err);
      } finally {
        if (this.isRunning) {
          this.intervalTimer = setTimeout(poll, intervalMs);
        }
      }
    };

    this.intervalTimer = setTimeout(poll, intervalMs);
  }

  /**
   * Stops poller cleanly.
   */
  stop(): void {
    this.isRunning = false;
    if (this.intervalTimer) {
      clearTimeout(this.intervalTimer);
      this.intervalTimer = null;
    }
  }
}
