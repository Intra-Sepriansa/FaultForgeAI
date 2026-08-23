export interface PromptTemplate {
  name: string;
  version: string;
  template: string;
}

export const PROMPTS = {
  TRIAGE: {
    name: 'triage_specialist',
    version: 'v1.0.0',
    template: `You are the TRIAGE_AGENT for FaultForge AI.
Analyze the incident telemetry, error logs, and scenario context.
Scenario: {{scenarioTitle}} (Code: {{scenarioCode}})
Category: {{category}}
Error Log Evidence:
{{errorLogs}}

Task:
1. Identify the root cause mechanism.
2. Produce a list of ranked hypotheses with confidence score (0.0 - 1.0) and citations to evidence IDs.`,
  },
  BACKEND: {
    name: 'backend_specialist',
    version: 'v1.0.0',
    template: `You are the BACKEND_AGENT for FaultForge AI.
Given the verified root cause:
Root Cause: {{rootCause}}
Target File Location: {{sourceLocation}}

Task:
1. Generate Candidate Patch A (Alternative / conservative approach).
2. Generate Candidate Patch B (Production-grade atomic / high-throughput approach).
Ensure all diffs follow standard unified diff format without placeholders.`,
  },
  VERIFICATION: {
    name: 'verification_specialist',
    version: 'v1.0.0',
    template: `You are the VERIFICATION_AGENT for FaultForge AI.
Target Patch:
{{patchDiff}}

Task:
1. Run deterministic stress test under concurrency.
2. Validate baseline invariant and assertion logs.`,
  },
  SAFETY: {
    name: 'safety_specialist',
    version: 'v1.0.0',
    template: `You are the SAFETY_AGENT for FaultForge AI.
Audit the following candidate patch for security vulnerabilities, SQL injection, locking deadlocks, and memory leaks:
Patch:
{{patchDiff}}

Task:
1. Evaluate compliance with production security policy.
2. Return risk score (0-100) and recommendation (APPROVE/REJECT).`,
  },
};

export class PromptRenderer {
  static render(template: string, variables: Record<string, string>): string {
    let result = template;
    for (const [key, value] of Object.entries(variables)) {
      result = result.replaceAll(`{{${key}}}`, value);
    }
    return result;
  }
}
