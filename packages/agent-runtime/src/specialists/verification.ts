import type { LLMProvider } from '../provider.js';
import { PROMPTS, PromptRenderer } from '../prompts.js';
import {
  VerificationOutputSchema,
  type VerificationOutput,
  type LLMCompletionResult,
} from '../types.js';

export interface VerificationInput {
  patchDiff: string;
}

export class VerificationAgent {
  private provider: LLMProvider;

  constructor(provider: LLMProvider) {
    this.provider = provider;
  }

  async run(input: VerificationInput): Promise<LLMCompletionResult<VerificationOutput>> {
    const prompt = PromptRenderer.render(PROMPTS.VERIFICATION.template, {
      patchDiff: input.patchDiff,
    });

    return this.provider.completeStructured(prompt, VerificationOutputSchema);
  }
}
