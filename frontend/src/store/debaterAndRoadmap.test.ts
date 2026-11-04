import { describe, it, expect } from 'vitest';
import { parseHashRoute, getInitialStepFromHash, scanReducer, createInitialState } from './scanStore';
import {
  filterAndSortFindings,
  computeDebaterSummary,
  getConfidenceColor,
} from '../utils/debaterUtils';
import {
  sortRoadmapNodes,
  filterRoadmapNodes,
  calculateProjectedScore,
  getStartHereNode,
  generateAiFixPrompt,
  generateMarkdownExport,
  generateCsvExport,
  generateGitHubIssues,
} from '../utils/roadmapUtils';
import { TriageResult, RoadmapNode } from '../types';

describe('Hash Routing for Step 4 & 5', () => {
  it('parses #/scan/:scanId/step/4 and #/scan/:scanId/step/5', () => {
    const route4 = parseHashRoute('#/scan/scan-abc-123/step/4');
    expect(route4.scanId).toBe('scan-abc-123');
    expect(route4.step).toBe(4);

    const route5 = parseHashRoute('#/scan/scan-xyz-789/step/5');
    expect(route5.scanId).toBe('scan-xyz-789');
    expect(route5.step).toBe(5);
  });

  it('parses legacy #/step/:step', () => {
    const route = parseHashRoute('#/step/3');
    expect(route.scanId).toBeNull();
    expect(route.step).toBe(3);
  });

  it('respects furthestStep boundary', () => {
    // If furthest step is 3, cannot jump to 5
    const step = getInitialStepFromHash(3);
    // Since window.location in node env is empty or mock, default is 1
    expect(step).toBeLessThanOrEqual(3);
  });
});

describe('Debater Utils (Step 4)', () => {
  const sampleFindings: TriageResult[] = [
    {
      id: 'f-sqli',
      module: 'sqli',
      url: 'http://localhost:5000/search',
      param: 'q',
      verdict: 'confirmed',
      severity: 'Critical',
      owasp: 'A03:2021-Injection',
      confidence: 0.98,
      reason: 'SQL syntax leak',
      evidence: { request: 'GET /search', response_excerpt: 'SQL Error', signal: 'syntax' },
    },
    {
      id: 'f-xss',
      module: 'xss',
      url: 'http://localhost:5000/profile',
      param: 'name',
      verdict: 'rejected',
      severity: 'Medium',
      owasp: 'A03:2021-Injection',
      confidence: 0.45,
      reason: 'Mitigated by template escaping',
      evidence: { request: 'GET /profile', response_excerpt: '&lt;script&gt;', signal: 'escaped' },
    },
    {
      id: 'f-headers',
      module: 'security_headers',
      url: 'http://localhost:5000/',
      verdict: 'confirmed',
      severity: 'Low',
      owasp: 'A05:2021-Security Misconfiguration',
      confidence: 0.88,
      reason: 'Missing CSP header',
      evidence: { request: 'GET /', response_excerpt: 'HTTP 200', signal: 'missing header' },
    },
  ];

  it('filters findings by verdict correctly', () => {
    const confirmed = filterAndSortFindings(sampleFindings, 'confirmed', 'severity', '');
    expect(confirmed.length).toBe(2);
    expect(confirmed.every((f) => f.verdict === 'confirmed')).toBe(true);

    const rejected = filterAndSortFindings(sampleFindings, 'rejected', 'severity', '');
    expect(rejected.length).toBe(1);
    expect(rejected[0].id).toBe('f-xss');
  });

  it('sorts findings by severity (Critical > High > Medium > Low)', () => {
    const sorted = filterAndSortFindings(sampleFindings, 'all', 'severity', '');
    expect(sorted[0].severity).toBe('Critical');
    expect(sorted[sorted.length - 1].severity).toBe('Low');
  });

  it('searches by module or endpoint string', () => {
    const results = filterAndSortFindings(sampleFindings, 'all', 'severity', 'profile');
    expect(results.length).toBe(1);
    expect(results[0].id).toBe('f-xss');
  });

  it('computes summary statistics and estimated manual triage hours saved', () => {
    const summary = computeDebaterSummary(sampleFindings, 5);
    expect(summary.rawFlags).toBe(5);
    expect(summary.confirmed).toBe(2);
    expect(summary.rejected).toBe(1);
    expect(summary.falseAlarmsRemoved).toBe(1);
    // 3 findings * 12 mins = 36 mins
    expect(summary.estimatedMinutesSaved).toBe(36);
  });

  it('maps confidence scores to appropriate color bands', () => {
    expect(getConfidenceColor(0.40).band).toBe('low');
    expect(getConfidenceColor(0.75).band).toBe('medium');
    expect(getConfidenceColor(0.95).band).toBe('high');
  });
});

describe('Roadmap Utils (Step 5)', () => {
  const sampleNodes: RoadmapNode[] = [
    {
      id: 'node-sqli',
      issue: 'SQL Injection in Search Endpoint',
      severity: 'Critical',
      owasp: 'A03:2021-Injection',
      root_cause: 'Unparameterized database query execution',
      affects: ['http://localhost:5000/search'],
      fix_steps: ['Use parameterized queries'],
      code_example: 'cursor.execute("SELECT * FROM items WHERE q = ?", (q,))',
      verify: 'Re-probe with single quote',
      resolves_count: 1,
      status: 'open',
      finding_ids: ['f-sqli'],
      effort: 'M',
      impact_score: 25,
      blocks: ['node-headers'],
    },
    {
      id: 'node-headers',
      issue: 'Missing Content Security Policy',
      severity: 'Low',
      owasp: 'A05:2021-Security Misconfiguration',
      root_cause: 'Missing CSP header in HTTP response',
      affects: ['http://localhost:5000/'],
      fix_steps: ['Add Content-Security-Policy header'],
      code_example: 'response.headers["Content-Security-Policy"] = "default-src \'self\'"',
      verify: 'Inspect response headers',
      resolves_count: 1,
      status: 'open',
      finding_ids: ['f-headers'],
      effort: 'S',
      impact_score: 3,
      blocks: [],
    },
  ];

  it('orders nodes with highest impact and severity first', () => {
    const sorted = sortRoadmapNodes(sampleNodes, 'priority');
    expect(sorted[0].id).toBe('node-sqli');
    expect(sorted[1].id).toBe('node-headers');
  });

  it('calculates projected risk score when node is fixed', () => {
    const currentScore = 50;
    const projected = calculateProjectedScore(currentScore, sampleNodes[0]);
    // Critical is 25 weight -> 50 - 25 = 25
    expect(projected).toBe(25);
  });

  it('identifies the single highest-leverage start here recommendation', () => {
    const startHere = getStartHereNode(sampleNodes);
    expect(startHere?.id).toBe('node-sqli');
  });

  it('filters quick wins (effort === S)', () => {
    const quickWins = filterRoadmapNodes(sampleNodes, 'quick_wins');
    expect(quickWins.length).toBe(1);
    expect(quickWins[0].id).toBe('node-headers');
  });

  it('generates Claude Code, Cursor, and Generic AI prompts', () => {
    const claudePrompt = generateAiFixPrompt(sampleNodes[0], 'claude', false);
    expect(claudePrompt).toContain('claude "Fix security issue: SQL Injection');

    const cursorPrompt = generateAiFixPrompt(sampleNodes[0], 'cursor', false);
    expect(cursorPrompt).toContain('@file Check and fix SQL Injection');

    const genericPrompt = generateAiFixPrompt(sampleNodes[0], 'generic', true, 'GET /search?q=1');
    expect(genericPrompt).toContain('### Security Remediation Specification');
    expect(genericPrompt).toContain('GET /search?q=1');
  });

  it('generates Markdown, CSV, and GitHub Issues exports', () => {
    const md = generateMarkdownExport(sampleNodes, 28, 'http://localhost:5000');
    expect(md).toContain('# NikSpider Security Remediation Roadmap');
    expect(md).toContain('[ ] SQL Injection in Search Endpoint');

    const csv = generateCsvExport(sampleNodes);
    expect(csv).toContain('SQL Injection in Search Endpoint');
    expect(csv).toContain('Critical');

    const gh = generateGitHubIssues(sampleNodes);
    expect(gh).toContain('### Title: [SECURITY] Fix SQL Injection in Search Endpoint');
  });
});

describe('Step 5 Gating and Retest Store Transitions', () => {
  it('keeps Step 5 locked during triage and unlocks when roadmap_ready fires', () => {
    const state0 = createInitialState('target-1', 'http://localhost:5000');
    expect(state0.steps[5]).toBe('locked');

    // Dispatch roadmap_ready event
    const stateWithRoadmap = scanReducer(state0, {
      type: 'SSE_EVENT',
      payload: { type: 'roadmap_ready', nodes: 2, score: 35 },
    });
    expect(stateWithRoadmap.steps[4]).toBe('done');
    expect(stateWithRoadmap.steps[5]).toBe('done');
    expect(stateWithRoadmap.furthestStep).toBeGreaterThanOrEqual(5);
  });

  it('updates roadmap node to fixed on successful retest', () => {
    const state0 = createInitialState('target-1', 'http://localhost:5000');
    state0.roadmap.nodes = [
      {
        id: 'node-1',
        issue: 'SQL Injection',
        severity: 'Critical',
        owasp: 'A03',
        root_cause: 'Root cause',
        affects: ['/search'],
        fix_steps: [],
        code_example: '',
        verify: '',
        resolves_count: 1,
        status: 'open',
        finding_ids: ['f-1'],
      },
    ];
    state0.kpis.riskScore = 25;

    const retestState = scanReducer(state0, {
      type: 'RETEST_RESULT',
      payload: {
        findingId: 'f-1',
        nodeId: 'node-1',
        passed: true,
        status: 'fixed',
        message: 'Fixed confirmed',
        score: 0,
      },
    });

    expect(retestState.roadmap.nodes[0].status).toBe('fixed');
    expect(retestState.kpis.riskScore).toBe(0);
  });
});

