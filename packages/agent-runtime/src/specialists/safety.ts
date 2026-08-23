import type { LLMProvider } from '../provider.js';
import { PROMPTS, PromptRenderer } from '../prompts.js';
import { SafetyOutputSchema, type SafetyOutput, type LLMCompletionResult } from '../types.js';

export interface SafetyInput {
  patchDiff: string;
}

export class SafetyAgent {
  private provider: LLMProvider;

  constructor(provider: LLMProvider) {
    this.provider = provider;
  }

  async run(input: SafetyInput): Promise<LLMCompletionResult<SafetyOutput>> {
    const prompt = PromptRenderer.render(PROMPTS.SAFETY.template, {
      patchDiff: input.patchDiff,
    });

    return this.provider.completeStructured(prompt, SafetyOutputSchema);
  }
}
