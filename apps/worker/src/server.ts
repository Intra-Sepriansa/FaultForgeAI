import { OutboxPoller } from './processors/outbox-poller.js';
import { createIncidentWorker } from './processors/incident-processor.js';
import { closeQueues } from './queues.js';
import type { Worker } from 'bullmq';

export class WorkerServer {
  private outboxPoller = new OutboxPoller();
  private incidentWorker: Worker | null = null;

  async start(): Promise<void> {
    console.info('[FaultForge Worker] Starting Outbox Poller & Background Processors...');
    this.incidentWorker = createIncidentWorker();
    this.outboxPoller.start(1000);
    console.info('[FaultForge Worker] Background worker engine is active.');
  }

  async stop(): Promise<void> {
    console.info('[FaultForge Worker] Stopping workers gracefully...');
    this.outboxPoller.stop();
    if (this.incidentWorker) {
      await this.incidentWorker.close();
    }
    await closeQueues();
    console.info('[FaultForge Worker] Workers stopped cleanly.');
  }

  getPoller(): OutboxPoller {
    return this.outboxPoller;
  }
}
