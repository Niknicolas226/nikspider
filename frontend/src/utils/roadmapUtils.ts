import { RoadmapNode, Severity } from '../types';

export type RoadmapFilter = 'all' | 'quick_wins' | 'critical_path' | 'open' | 'fixed';
export type RoadmapSortOption = 'priority' | 'impact' | 'effort' | 'affected';

export const SEVERITY_SCORES: Record<Severity, number> = {
  Critical: 25,
  High: 15,
  Medium: 8,
  Low: 3,
};

export const EFFORT_ORDER: Record<'S' | 'M' | 'L', number> = {
  S: 1,
  M: 2,
  L: 3,
};

export function filterRoadmapNodes(nodes: RoadmapNode[], filter: RoadmapFilter): RoadmapNode[] {
  switch (filter) {
    case 'quick_wins':
      return nodes.filter((n) => (n.effort || 'M') === 'S' && n.status !== 'fixed');
    case 'critical_path':
      return nodes.filter(
        (n) => (n.severity === 'Critical' || n.severity === 'High') && n.status !== 'fixed'
      );
    case 'open':
      return nodes.filter((n) => n.status !== 'fixed');
    case 'fixed':
      return nodes.filter((n) => n.status === 'fixed');
    case 'all':
    default:
      return nodes;
  }
}

export function sortRoadmapNodes(
  nodes: RoadmapNode[],
  sortBy: RoadmapSortOption = 'priority'
): RoadmapNode[] {
  return [...nodes].sort((a, b) => {
    // Fixed nodes always float down
    if (a.status === 'fixed' && b.status !== 'fixed') return 1;
    if (a.status !== 'fixed' && b.status === 'fixed') return -1;

    if (sortBy === 'impact') {
      const impA = a.impact_score ?? (SEVERITY_SCORES[a.severity] || 5);
      const impB = b.impact_score ?? (SEVERITY_SCORES[b.severity] || 5);
      return impB - impA;
    }

    if (sortBy === 'effort') {
      const effA = EFFORT_ORDER[a.effort || 'M'] ?? 2;
      const effB = EFFORT_ORDER[b.effort || 'M'] ?? 2;
      return effA - effB;
    }

    if (sortBy === 'affected') {
      return (b.affects?.length || 0) - (a.affects?.length || 0);
    }

    // Default 'priority': Criticality weight * affected breadth with unblocking logic
    const scoreA = (SEVERITY_SCORES[a.severity] || 5) * Math.max(1, a.affects?.length || 1);
    const scoreB = (SEVERITY_SCORES[b.severity] || 5) * Math.max(1, b.affects?.length || 1);
    if (scoreA !== scoreB) return scoreB - scoreA;
    return (b.blocks?.length || 0) - (a.blocks?.length || 0);
  });
}

export function calculateProjectedScore(currentScore: number, node: RoadmapNode): number {
  if (node.status === 'fixed') return currentScore;
  const weight = SEVERITY_SCORES[node.severity] || 5;
  return Math.max(0, currentScore - weight);
}

export function getStartHereNode(nodes: RoadmapNode[]): RoadmapNode | null {
  const open = nodes.filter((n) => n.status !== 'fixed');
  if (open.length === 0) return null;
  const sorted = sortRoadmapNodes(open, 'priority');
  return sorted[0] || null;
}

export function generateAiFixPrompt(
  node: RoadmapNode,
  tool: 'claude' | 'cursor' | 'generic',
  includeEvidence: boolean = false,
  evidenceText?: string
): string {
  const fileHints = (node.affects || []).map((u) => {
    try {
      const parsed = new URL(u);
      return parsed.pathname;
    } catch {
      return u;
    }
  });

  const stepsList = (node.fix_steps || []).map((s, i) => `${i + 1}. ${s}`).join('\n');
  const codeBlock = node.code_example ? `\n\`\`\`\n${node.code_example}\n\`\`\`\n` : '';
  const evidenceBlock =
    includeEvidence && evidenceText
      ? `\n### Attached HTTP Vulnerability Proof:\n\`\`\`http\n${evidenceText.slice(0, 1500)}\n\`\`\`\n`
      : '';

  if (tool === 'claude') {
    return `claude "Fix security issue: ${node.issue} (${node.severity} - ${node.owasp}).
Affects paths: ${fileHints.join(', ')}

Root Cause: ${node.root_cause}

Remediation steps:
${stepsList}
${codeBlock}${evidenceBlock}
Verify using:
${node.verify || 'Run tests & verify input validation'}"`;
  }

  if (tool === 'cursor') {
    return `@file Check and fix ${node.issue} (${node.severity}).
Root cause: ${node.root_cause}
Affected routes: ${fileHints.join(', ')}

Instructions:
${stepsList}

Expected implementation pattern:
${codeBlock}${evidenceBlock}
Verification: ${node.verify}`;
  }

  // Generic
  return `### Security Remediation Specification
**Issue:** ${node.issue}
**Severity:** ${node.severity} | **OWASP:** ${node.owasp} | **Effort:** ${node.effort || 'M'}
**Root Cause:** ${node.root_cause}
**Affected Routes:**
${fileHints.map((f) => `- ${f}`).join('\n')}

### Remediation Plan:
${stepsList}

### Recommended Implementation:
${codeBlock}${evidenceBlock}
### Verification Probe:
${node.verify || 'Re-probe endpoint to verify sanitization and response status.'}`;
}

export function generateMarkdownExport(
  nodes: RoadmapNode[],
  riskScore: number,
  targetUrl: string
): string {
  const open = nodes.filter((n) => n.status !== 'fixed');
  const fixed = nodes.filter((n) => n.status === 'fixed');

  let md = `# NikSpider Security Remediation Roadmap\n\n`;
  md += `**Target:** \`${targetUrl}\`  \n`;
  md += `**Current Risk Score:** **${riskScore}/100**  \n`;
  md += `**Progress:** ${fixed.length} / ${nodes.length} nodes remediated (${Math.round((fixed.length / (nodes.length || 1)) * 100)}%)  \n\n`;

  md += `## Remediation Checklist\n\n`;
  for (const n of nodes) {
    const check = n.status === 'fixed' ? '[x]' : '[ ]';
    md += `### ${check} ${n.issue} (${n.severity})\n`;
    md += `- **OWASP:** ${n.owasp}\n`;
    md += `- **Effort:** ${n.effort || 'M'} | **Impact:** -${n.impact_score || SEVERITY_SCORES[n.severity] || 5} pts\n`;
    md += `- **Root Cause:** ${n.root_cause}\n`;
    md += `- **Affected Routes:** ${n.affects?.join(', ') || 'N/A'}\n`;
    md += `- **Fix Steps:**\n`;
    for (const step of n.fix_steps || []) {
      md += `  1. ${step}\n`;
    }
    if (n.code_example) {
      md += `\n\`\`\`\n${n.code_example}\n\`\`\`\n`;
    }
    md += `\n`;
  }
  return md;
}

export function generateCsvExport(nodes: RoadmapNode[]): string {
  const headers = ['ID', 'Issue', 'Severity', 'OWASP', 'Status', 'Effort', 'Impact Score', 'Affected Count', 'Root Cause'];
  const rows = nodes.map((n) => [
    `"${n.id}"`,
    `"${n.issue.replace(/"/g, '""')}"`,
    `"${n.severity}"`,
    `"${n.owasp}"`,
    `"${n.status}"`,
    `"${n.effort || 'M'}"`,
    `"${n.impact_score || SEVERITY_SCORES[n.severity] || 5}"`,
    `"${n.affects?.length || 0}"`,
    `"${n.root_cause.replace(/"/g, '""')}"`,
  ]);
  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
}

export function generateGitHubIssues(nodes: RoadmapNode[]): string {
  return nodes
    .filter((n) => n.status !== 'fixed')
    .map((n) => {
      const labels = `security, nikspider, severity:${n.severity.toLowerCase()}, effort:${(n.effort || 'M').toLowerCase()}`;
      return `### Title: [SECURITY] Fix ${n.issue}\n**Labels:** \`${labels}\`\n\n#### Description:\n${n.root_cause}\n\n#### Affected Endpoints:\n${(n.affects || []).map((a) => `- \`${a}\``).join('\n')}\n\n#### Fix Guidance:\n${(n.fix_steps || []).map((s, i) => `${i + 1}. ${s}`).join('\n')}\n\n\`\`\`\n${n.code_example || '# Apply fix'}\n\`\`\`\n\n---\n`;
    })
    .join('\n');
}

