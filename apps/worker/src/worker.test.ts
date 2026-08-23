import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  prisma,
  disconnectPrisma,
  disconnectRedis,
  seedDatabase,
  OutboxRepository,
} from '@faultforge/database';
import { IncidentStatus } from '@prisma/client';
import { IncidentStateMachine } from './state-machine.js';
import { WorkerServer } from './server.js';
import { incidentQueue } from './queues.js';

describe('Background Worker Engine & State Machine Integration Tests', () => {
  let server: WorkerServer;
  let workspaceId: string;
  let scenarioId: string;

  beforeAll(async () => {
    await seedDatabase();
    const ws = await prisma.workspace.findFirstOrThrow();
    const sc = await prisma.scenarioDefinition.findFirstOrThrow();
    workspaceId = ws.id;
    scenarioId = sc.id;

    server = new WorkerServer();
    await server.start();
  });

  afterAll(async () => {
    await server.stop();
    await disconnectPrisma();
    await disconnectRedis();
  });

  describe('Incident State Machine Transition Validation', () => {
    it('allows valid sequential transitions', async () => {
      const incident = await prisma.incidentRun.create({
        data: {
          workspaceId,
          scenarioId,
          status: IncidentStatus.INITIATED,
          snapshotHash: 'snap-sm-test-1',
        },
      });

      // INITIATED -> FAULT_INJECTED
      const s1 = await IncidentStateMachine.transition(incident.id, IncidentStatus.FAULT_INJECTED);
      expect(s1.status).toBe(IncidentStatus.FAULT_INJECTED);

      // FAULT_INJECTED -> INVESTIGATING
      const s2 = await IncidentStateMachine.transition(incident.id, IncidentStatus.INVESTIGATING);
      expect(s2.status).toBe(IncidentStatus.INVESTIGATING);

      // INVESTIGATING -> REPRODUCED
      const s3 = await IncidentStateMachine.transition(incident.id, IncidentStatus.REPRODUCED);
      expect(s3.status).toBe(IncidentStatus.REPRODUCED);
    });

    it('rejects illegal state transitions (e.g. INITIATED directly to DEPLOYED_CANARY)', async () => {
      const incident = await prisma.incidentRun.create({
        data: {
          workspaceId,
          scenarioId,
          status: IncidentStatus.INITIATED,
          snapshotHash: 'snap-sm-test-2',
        },
      });

      await expect(
        IncidentStateMachine.transition(incident.id, IncidentStatus.DEPLOYED_CANARY),
      ).rejects.toThrow('Illegal state transition');
    });
  });

  describe('Outbox Poller to BullMQ Pipeline End-to-End', () => {
    it('processes outbox event, dispatches BullMQ job, and advances incident to REPRODUCED state', async () => {
      // 1. Create an Incident in FAULT_INJECTED state
      const incident = await prisma.incidentRun.create({
        data: {
          workspaceId,
          scenarioId,
          status: IncidentStatus.FAULT_INJECTED,
          snapshotHash: 'snap-e2e-worker-1',
        },
      });

      // 2. Enqueue Outbox Event
      const outboxEvt = await OutboxRepository.enqueue({
        workspaceId,
        eventType: 'INCIDENT_INJECTED',
        payload: {
          incidentRunId: incident.id,
          scenarioCode: 'COMMERCE_RACE_CONDITION',
          snapshotHash: 'snap-e2e-worker-1',
        },
      });

      expect(outboxEvt.status).toBe('PENDING');

      // 3. Trigger Outbox Poller batch processing
      const processedCount = await server.getPoller().processBatch();
      expect(processedCount).toBeGreaterThan(0);

      // 4. Wait for BullMQ worker to process the job
      await new Promise((resolve) => setTimeout(resolve, 600));

      // 5. Verify Incident state has advanced to REPRODUCED
      const updatedIncident = await prisma.incidentRun.findUnique({
        where: { id: incident.id },
        include: { evidence: true, hypotheses: true },
      });

      expect(updatedIncident?.status).toBe(IncidentStatus.REPRODUCED);
      expect(updatedIncident?.evidence.length).toBeGreaterThan(0);
      expect(updatedIncident?.hypotheses.length).toBeGreaterThan(0);
      expect(updatedIncident?.hypotheses[0]?.rank).toBe(1);
    });

    it('deduplicates jobs using deterministic job IDs in BullMQ queue', async () => {
      const jobId = `dedup-test-${Date.now()}`;

      // First add
      const job1 = await incidentQueue.add('INCIDENT_INJECTED', { test: 'data1' }, { jobId });

      // Second add with same jobId
      const job2 = await incidentQueue.add('INCIDENT_INJECTED', { test: 'data2' }, { jobId });

      expect(job1.id).toBe(job2.id);
    });
  });
});
