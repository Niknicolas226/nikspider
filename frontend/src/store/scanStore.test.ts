import { describe, it, expect, beforeEach } from 'vitest';
import {
  scanReducer,
  createInitialState,
  ScanState,
} from './scanStore';
import { SSEEvent, PlanItem, TriageResult } from '../types';

describe('scanReducer 6-step workflow', () => {
  let initialState: ScanState;

  beforeEach(() => {
    initialState = createInitialState('test-target-123', 'http://localhost:5000');
  });

  // ═══════════════════════════════════════════════════════════════════
  // 1. EVENT -> STEP TRANSITIONS
  // ═══════════════════════════════════════════════════════════════════
  it('transitions through steps 1 -> 2 -> 3 -> 4 -> 5 on matching events', () => {
    // Step 1: Start Scan
    const startingState = scanReducer(initialState, { type: 'START_SCAN_REQUEST' });
    expect(startingState.steps[1]).toBe('running');

    const startedState = scanReducer(startingState, {
      type: 'START_SCAN_SUCCESS',
      payload: { scanId: 'scan-abc-123' },
    });
    expect(startedState.steps[1]).toBe('done');
    expect(startedState.steps[2]).toBe('running');
    expect(startedState.currentStep).toBe(2);
    expect(startedState.furthestStep).toBe(2);

    // Step 2: Crawl Progress
    const crawlEvent: SSEEvent = {
      type: 'crawl_progress',
      pages: 14,
      queue: 2,
      url: 'http://localhost:5000/api/users',
    };
    const crawlingState = scanReducer(startedState, {
      type: 'SSE_EVENT',
      payload: crawlEvent,
    });
    expect(crawlingState.steps[2]).toBe('running');
    expect(crawlingState.crawl.pages).toBe(14);
    expect(crawlingState.kpis.endpoints).toBe(14);

    // Step 2 -> 3: Plan Ready
    const planEvent: SSEEvent = {
      type: 'plan_ready',
      plan: [{ url: '/login', checks: ['sqli', 'xss'], why: 'Authentication form' }],
    };
    const planState = scanReducer(crawlingState, {
      type: 'SSE_EVENT',
      payload: planEvent,
    });
    expect(planState.steps[2]).toBe('done');
    expect(planState.steps[3]).toBe('running');
    expect(planState.currentStep).toBe(3);
    expect(planState.furthestStep).toBe(3);

    // Step 3 -> 4: First Triage Result
    const triageEvent: SSEEvent = {
      type: 'triage_result',
      id: 'vuln-sqli-01',
      module: 'sqli',
      url: 'http://localhost:5000/search',
      verdict: 'confirmed',
      severity: 'Critical',
      owasp: 'A03:2021-Injection',
      confidence: 0.98,
      reason: 'Boolean diff signal reproduced with parameter tampering',
      evidence: {
        request: 'GET /search?q=1%27+OR+1=1',
        response_excerpt: 'HTTP 200 SQL Syntax Error',
        signal: 'SQL syntax leak',
      },
    };
    const triageState = scanReducer(planState, {
      type: 'SSE_EVENT',
      payload: triageEvent,
    });
    expect(triageState.steps[3]).toBe('done');
    expect(triageState.steps[4]).toBe('running');
    expect(triageState.currentStep).toBe(4);
    expect(triageState.furthestStep).toBe(4);
    expect(triageState.kpis.confirmed).toBe(1);
    expect(triageState.kpis.highSeverity).toBe(1);

    // Step 4 -> 5: Roadmap Ready (Hand-off)
    const roadmapEvent: SSEEvent = {
      type: 'roadmap_ready',
      nodes: 3,
      score: 75,
    };
    const roadmapState = scanReducer(triageState, {
      type: 'SSE_EVENT',
      payload: roadmapEvent,
    });
    expect(roadmapState.steps[4]).toBe('done');
    expect(roadmapState.steps[5]).toBe('done');
    expect(roadmapState.steps[6]).toBe('active');
    expect(roadmapState.currentStep).toBe(5);
    expect(roadmapState.furthestStep).toBe(6);
    expect(roadmapState.kpis.riskScore).toBe(75);
    expect(roadmapState.scanStatus).toBe('completed');
  });

  // ═══════════════════════════════════════════════════════════════════
  // 2. NO FORWARD-YANK WHEN VIEWING AN OLDER STEP
  // ═══════════════════════════════════════════════════════════════════
  it('does NOT yank the user forward if they navigated back to an older step', () => {
    // Start scan and advance to step 3
    let state = scanReducer(initialState, {
      type: 'START_SCAN_SUCCESS',
      payload: { scanId: 'scan-xyz' },
    });
    state = scanReducer(state, {
      type: 'SSE_EVENT',
      payload: { type: 'plan_ready', plan: [] },
    });
    expect(state.currentStep).toBe(3);

    // User explicitly navigates back to Step 2 report to inspect endpoints
    state = scanReducer(state, { type: 'GO_TO_STEP', payload: 2 });
    expect(state.currentStep).toBe(2);

    // Background event: Triage result arrives (completes step 3, starts step 4)
    state = scanReducer(state, {
      type: 'SSE_EVENT',
      payload: {
        type: 'triage_result',
        id: 'f1',
        verdict: 'confirmed',
        severity: 'High',
        owasp: 'A01',
        confidence: 0.9,
        reason: 'Auth bypass',
        evidence: { request: '', response_excerpt: '', signal: '' },
      },
    });

    // User MUST stay on Step 2! (No forward-yank)
    expect(state.currentStep).toBe(2);
    // Furthest step should advance to 4
    expect(state.furthestStep).toBe(4);
    // Non-blocking toast should offer navigation
    expect(state.toast?.message).toContain('Step 3 finished');
    expect(state.toast?.actionStep).toBe(4);
  });

  // ═══════════════════════════════════════════════════════════════════
  // 3. LOCKED-STEP GATING
  // ═══════════════════════════════════════════════════════════════════
  it('blocks navigation to locked steps with a helpful warning toast', () => {
    // Initially only Step 1 is active, Steps 2-6 are locked
    expect(initialState.currentStep).toBe(1);
    expect(initialState.steps[4]).toBe('locked');

    // Attempting to jump directly to Step 4 should be rejected
    const blockedState = scanReducer(initialState, { type: 'GO_TO_STEP', payload: 4 });
    expect(blockedState.currentStep).toBe(1);
    expect(blockedState.toast?.message).toBe('Complete step 3 first');

    // Unlocking Step 2 via START_SCAN_SUCCESS
    const unlockedState = scanReducer(initialState, {
      type: 'START_SCAN_SUCCESS',
      payload: { scanId: 'scan-1' },
    });
    // Now Step 2 is accessible
    const navigatedState = scanReducer(unlockedState, { type: 'GO_TO_STEP', payload: 2 });
    expect(navigatedState.currentStep).toBe(2);

    // But Step 5 is still locked
    const stillBlocked = scanReducer(navigatedState, { type: 'GO_TO_STEP', payload: 5 });
    expect(stillBlocked.currentStep).toBe(2);
    expect(stillBlocked.toast?.message).toBe('Complete step 4 first');
  });

  // ═══════════════════════════════════════════════════════════════════
  // 4. RESUME-AFTER-REFRESH
  // ═══════════════════════════════════════════════════════════════════
  it('restores persisted state after session resume', () => {
    // Simulate active scan state
    let state = scanReducer(initialState, {
      type: 'START_SCAN_SUCCESS',
      payload: { scanId: 'resumed-scan-999' },
    });
    state = scanReducer(state, {
      type: 'SSE_EVENT',
      payload: {
        type: 'crawl_progress',
        pages: 35,
        queue: 0,
        url: 'http://localhost:5000/api/dashboard',
      },
    });
    state = scanReducer(state, {
      type: 'SSE_EVENT',
      payload: {
        type: 'plan_ready',
        plan: [{ url: '/api/v1', checks: ['xss'], why: 'API endpoint' }],
      },
    });

    // Reconcile roadmap data from server on refresh
    const refreshedState = scanReducer(state, {
      type: 'SET_ROADMAP',
      payload: {
        score: 45,
        raw_count: 5,
        confirmed_count: 2,
        rejected_count: 3,
        nodes: [
          {
            id: 'node-1',
            issue: 'Reflected XSS on /search',
            severity: 'High',
            owasp: 'A03',
            root_cause: 'Unsanitized query echo',
            affects: ['/search'],
            fix_steps: ['HTML encode input'],
            code_example: 'DOMPurify.sanitize(q)',
            verify: 'GET /search?q=<script>',
            resolves_count: 1,
            status: 'open',
            finding_ids: ['f-xss-1'],
          },
        ],
      },
    });

    expect(refreshedState.scanId).toBe('resumed-scan-999');
    expect(refreshedState.kpis.riskScore).toBe(45);
    expect(refreshedState.roadmap.nodes.length).toBe(1);
    expect(refreshedState.furthestStep).toBe(3);
  });
});

