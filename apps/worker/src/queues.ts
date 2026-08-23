import { Queue, type DefaultJobOptions } from 'bullmq';
import { redis } from '@faultforge/database';

export const DEFAULT_JOB_OPTIONS: DefaultJobOptions = {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 1000,
  },
  removeOnComplete: {
    count: 1000,
    age: 86400,
  },
  removeOnFail: {
    count: 5000,
  },
};

export const INCIDENT_QUEUE_NAME = 'faultforge-incident-jobs';
export const OUTBOX_QUEUE_NAME = 'faultforge-outbox-jobs';

export const incidentQueue = new Queue(INCIDENT_QUEUE_NAME, {
  connection: redis,
  defaultJobOptions: DEFAULT_JOB_OPTIONS,
});

export const outboxQueue = new Queue(OUTBOX_QUEUE_NAME, {
  connection: redis,
  defaultJobOptions: DEFAULT_JOB_OPTIONS,
});

export async function closeQueues(): Promise<void> {
  await incidentQueue.close();
  await outboxQueue.close();
}
