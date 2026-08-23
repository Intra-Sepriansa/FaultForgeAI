import { Worker, type Job } from 'bullmq';
import { redis, prisma } from '@faultforge/database';
import { INCIDENT_QUEUE_NAME } from '../queues.js';
import { IncidentStateMachine } from '../state-machine.js';
import { IncidentStatus, ClaimStatus } from '@prisma/client';
import { AgentOrchestrator } from '@faultforge/agent-runtime';

export interface IncidentJobPayload {
  outboxEventId: string;
  workspaceId: string;
  eventType: string;
  payload: {
    incidentRunId?: string;
    scenarioCode?: string;
    snapshotHash?: string;
  };
  incidentRunId?: string;
  scenarioCode?: string;
  snapshotHash?: string;
}

export function createIncidentWorker(): Worker<IncidentJobPayload> {
  const orchestrator = new AgentOrchestrator();

  return new Worker<IncidentJobPayload>(
    INCIDENT_QUEUE_NAME,
    async (job: Job<IncidentJobPayload>) => {
      const data = job.data;
      const incidentRunId =
        data.payload?.incidentRunId ||
        data.incidentRunId ||
        (data as unknown as { incidentRunId: string }).incidentRunId;

      if (!incidentRunId) {
        return { success: false, error: 'Missing incidentRunId in job payload' };
      }

      const scenarioCode =
        data.payload?.scenarioCode || data.scenarioCode || 'COMMERCE_RACE_CONDITION';
      const snapshotHash = data.payload?.snapshotHash || data.snapshotHash || 'snapshot-default';

      // 1. Transition state: FAULT_INJECTED -> INVESTIGATING
      await IncidentStateMachine.transition(incidentRunId, IncidentStatus.INVESTIGATING);

      // 2. Simulate Evidence Collection (Telemetry capture)
      const evidence = await prisma.evidenceArtifact.create({
        data: {
          incidentRunId,
          type: 'LOG',
          sourceLocation: 'labs/commerce-lab/checkout',
          payload: {
            message:
              'Concurrent checkout detected stock discrepancy: stock decreased below threshold',
            scenarioCode,
            snapshotHash,
          },
        },
      });

      // 3. Generate Ranked Hypothesis
      await prisma.hypothesis.create({
        data: {
          incidentRunId,
          rank: 1,
          description: `Identified race condition in checkout handler for scenario '${scenarioCode}'. Non-atomic read-then-write sequence allows concurrent requests to overbook inventory.`,
          confidence: 0.95,
          claimStatus: ClaimStatus.VERIFIED,
          evidenceCites: [evidence.id],
        },
      });

      // 4. Run Multi-Agent Orchestration Investigation (Triage, Backend, Verification, Safety)
      const incident = await prisma.incidentRun.findUnique({
        where: { id: incidentRunId },
        include: { scenario: true },
      });

      if (incident?.scenario) {
        await orchestrator.runInvestigation({
          incidentRunId,
          scenarioCode: incident.scenario.code,
          scenarioTitle: incident.scenario.title,
          category: incident.scenario.category,
          errorLogs: 'Negative stock detected on concurrent checkout requests',
        });
      }

      // 5. Transition state: INVESTIGATING -> REPRODUCED
      await IncidentStateMachine.transition(incidentRunId, IncidentStatus.REPRODUCED);

      return {
        success: true,
        incidentRunId,
        reproduced: true,
        evidenceArtifactId: evidence.id,
      };
    },
    {
      connection: redis,
      concurrency: 5,
    },
  );
}
