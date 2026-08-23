export interface ReferenceCaseStudy {
  id: string;
  scenarioCode: string;
  title: string;
  category: string;
  difficulty: string;
  rootCauseAnalysis: string;
  engineeringRationale: string;
  verifiedDiff: string;
  reproductionCommand: string;
  expectedFailureMechanism: string;
  rolloutStrategy: string;
  rollbackStrategy: string;
  rubricScore: number;
  publishedAt: string;
  authorUserId: string;
}

export interface PostmortemReport {
  title: string;
  incidentId: string;
  scenarioCode: string;
  severity: string;
  date: string;
  authors: string[];
  summary: string;
  impact: string;
  rootCauses: string;
  trigger: string;
  resolution: string;
  detection: string;
  actionItems: Array<{ action: string; type: 'PREVENTATIVE' | 'MITIGATION'; owner: string }>;
  verifiedCodeDiff: string;
}
