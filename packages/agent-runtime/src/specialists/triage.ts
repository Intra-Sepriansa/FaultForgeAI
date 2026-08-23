import type { LLMProvider } from '../provider.js';
import { PROMPTS, PromptRenderer } from '../prompts.js';
import { TriageOutputSchema, type TriageOutput, type LLMCompletionResult } from '../types.js';

export interface TriageInput {
  scenarioCode: string;
  scenarioTitle: string;
  category: string;
  errorLogs: string;
}

export class TriageAgent {
  private provider: LLMProvider;

  constructor(provider: LLMProvider) {
    this.provider = provider;
  }

  async run(input: TriageInput): Promise<LLMCompletionResult<TriageOutput>> {
    const prompt = PromptRenderer.render(PROMPTS.TRIAGE.template, {
      scenarioCode: input.scenarioCode,
      scenarioTitle: input.scenarioTitle,
      category: input.category,
      errorLogs: input.errorLogs,
    });

    return this.provider.completeStructured(prompt, TriageOutputSchema);
  }
}
