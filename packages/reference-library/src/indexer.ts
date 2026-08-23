import type { ReferenceCaseStudy } from './types.js';

export interface SearchQueryOptions {
  category?: string;
  difficulty?: string;
  keyword?: string;
}

export class ReferenceIndexer {
  private cases: Map<string, ReferenceCaseStudy> = new Map();

  constructor(initialCases: ReferenceCaseStudy[] = []) {
    initialCases.forEach((c) => this.cases.set(c.scenarioCode, c));
  }

  addCase(caseStudy: ReferenceCaseStudy): void {
    this.cases.set(caseStudy.scenarioCode, caseStudy);
  }

  getCase(scenarioCode: string): ReferenceCaseStudy | undefined {
    return this.cases.get(scenarioCode);
  }

  getAll(): ReferenceCaseStudy[] {
    return Array.from(this.cases.values());
  }

  search(options: SearchQueryOptions): ReferenceCaseStudy[] {
    let results = this.getAll();

    if (options.category) {
      const cat = options.category.toLowerCase();
      results = results.filter((c) => c.category.toLowerCase() === cat);
    }

    if (options.difficulty) {
      const diff = options.difficulty.toLowerCase();
      results = results.filter((c) => c.difficulty.toLowerCase() === diff);
    }

    if (options.keyword) {
      const kw = options.keyword.toLowerCase();
      results = results.filter(
        (c) =>
          c.title.toLowerCase().includes(kw) ||
          c.rootCauseAnalysis.toLowerCase().includes(kw) ||
          c.engineeringRationale.toLowerCase().includes(kw) ||
          c.scenarioCode.toLowerCase().includes(kw),
      );
    }

    return results;
  }
}
