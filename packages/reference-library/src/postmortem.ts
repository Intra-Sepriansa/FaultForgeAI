import type { PostmortemReport } from './types.js';

export class PostmortemGenerator {
  /**
   * Formats a structured PostmortemReport into standard Markdown (Google SRE / PagerDuty compliant).
   */
  static toMarkdown(report: PostmortemReport): string {
    return `# SRE Postmortem: ${report.title}

**Incident ID:** \`${report.incidentId}\`  
**Scenario Code:** \`${report.scenarioCode}\`  
**Severity:** \`${report.severity}\`  
**Date:** ${report.date}  
**Authors:** ${report.authors.join(', ')}  

---

## Executive Summary
${report.summary}

## Impact
${report.impact}

## Root Cause Analysis
${report.rootCauses}

## Trigger
${report.trigger}

## Detection & Monitoring
${report.detection}

## Resolution & Rollout
${report.resolution}

---

## Action Items & Preventative Measures
${report.actionItems.map((item, i) => `${i + 1}. **[${item.type}]** ${item.action} *(Owner: ${item.owner})*`).join('\n')}

---

## Verified Solution Diff
\`\`\`diff
${report.verifiedCodeDiff}
\`\`\`
`;
  }
}
