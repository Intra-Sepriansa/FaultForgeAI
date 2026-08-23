import type { LLMProvider } from '../provider.js';
import { PROMPTS, PromptRenderer } from '../prompts.js';
import { BackendOutputSchema, type BackendOutput, type LLMCompletionResult } from '../types.js';

export interface BackendInput {
  rootCause: string;
  sourceLocation: string;
}

export class BackendAgent {
  private provider: LLMProvider;

  constructor(provider: LLMProvider) {
    this.provider = provider;
  }

  async run(input: BackendInput): Promise<LLMCompletionResult<BackendOutput>> {
    const prompt = PromptRenderer.render(PROMPTS.BACKEND.template, {
      rootCause: input.rootCause,
      sourceLocation: input.sourceLocation,
    });

    return this.provider.completeStructured(prompt, BackendOutputSchema);
  }
}
