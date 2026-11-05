import { useSyncExternalStore } from 'react';
import {
  ScanProfile,
  PlanItem,
  RawFlag,
  TriageResult,
  RoadmapNode,
  RoadmapResponse,
  RequestLogEntry,
  SSEEvent,
} from '../types';
import { StepId, StepStatus, STEPS } from '../config/steps';

export interface TerminalLogLine {
  id: string;
  tag: 'SYSTEM' | 'INFO' | 'WARN' | 'FLAG' | 'CMD' | 'ERROR';
  text: string;
  ts: string;
}

export interface RetestLogItem {
  id: string;
  findingId: string;
  nodeId?: string;
  passed: boolean;
  status: string;
  message: string;
  score?: number;
  ts: string;
}

export interface ScanToast {
  id: string;
  message: string;
  type?: 'info' | 'success' | 'warn' | 'error';
  actionStep?: StepId;
}

export interface ScanState {
  targetId: string | null;
  targetUrl: string | null;
  scanId: string | null;
  profile: ScanProfile;
  steps: Record<StepId, StepStatus>;
  currentStep: StepId;
  furthestStep: StepId;
  crawl: { pages: number; queue: number; url?: string };
  endpoints: string[];
  plan: PlanItem[];
  rawFlags: RawFlag[];
  verdicts: TriageResult[];
  roadmap: { nodes: RoadmapNode[]; score: number };
  requests: RequestLogEntry[];
  kpis: {
    riskScore: number | null;
    confirmed: number;
    highSeverity: number;
    endpoints: number;
    durationSec: number | null;
  };
  scanStartedAt: number | null;
  scanCompletedAt: number | null;
  scanStatus: 'idle' | 'starting' | 'running' | 'paused' | 'completed' | 'error';
  error: string | null;
  toast: ScanToast | null;
  retestHistory: RetestLogItem[];
  sseStatus: 'connected' | 'reconnecting' | 'disconnected';
  backendOnline: boolean;
  terminalLogs: TerminalLogLine[];
}

export type ScanAction =
  | { type: 'SET_TARGET'; payload: { targetId: string; targetUrl: string } }
  | { type: 'SET_PROFILE'; payload: ScanProfile }
  | { type: 'START_SCAN_REQUEST' }
  | { type: 'START_SCAN_SUCCESS'; payload: { scanId: string } }
  | { type: 'START_SCAN_ERROR'; payload: string }
  | { type: 'SSE_EVENT'; payload: SSEEvent }
  | { type: 'SET_ROADMAP'; payload: RoadmapResponse }
  | { type: 'SET_VERDICTS'; payload: TriageResult[] }
  | { type: 'SET_REQUESTS'; payload: RequestLogEntry[] }
  | {
      type: 'RETEST_RESULT';
      payload: {
        findingId: string;
        nodeId?: string;
        passed: boolean;
        status: string;
        message: string;
        score?: number;
      };
    }
  | { type: 'GO_TO_STEP'; payload: StepId }
  | { type: 'UNLOCK_STEP'; payload: StepId }
  | { type: 'SET_SSE_STATUS'; payload: 'connected' | 'reconnecting' | 'disconnected' }
  | { type: 'SET_BACKEND_ONLINE'; payload: boolean }
  | { type: 'UPDATE_DURATION'; payload: number }
  | { type: 'DISMISS_TOAST' }
  | { type: 'CLEAR_TERMINAL_LOGS' }
  | { type: 'APPEND_TERMINAL_LOG'; payload: { tag: TerminalLogLine['tag']; text: string } }
  | { type: 'RESET_SCAN' };

const SESSION_KEY = 'nikspider_scan_session';

export function parseHashRoute(hashString?: string): { step: StepId | null; scanId: string | null } {
  const hash = hashString ?? (typeof window !== 'undefined' ? window.location.hash : '');
  if (!hash) return { step: null, scanId: null };

  const scanStepMatch = hash.match(/#\/?scan\/([^/]+)\/step\/([1-6])/i);
  if (scanStepMatch) {
    return {
      scanId: decodeURIComponent(scanStepMatch[1]),
      step: parseInt(scanStepMatch[2], 10) as StepId,
    };
  }

  const stepMatch = hash.match(/#\/?step\/([1-6])/i);
  if (stepMatch) {
    return {
      scanId: null,
      step: parseInt(stepMatch[1], 10) as StepId,
    };
  }

  return { step: null, scanId: null };
}

export function getInitialStepFromHash(furthestStep: StepId): StepId {
  const { step, scanId } = parseHashRoute();
  if (step !== null && step >= 1 && step <= 6) {
    if (step <= furthestStep || scanId) {
      return step;
    }
  }
  return 1;
}

export function createInitialState(savedTargetId?: string, savedTargetUrl?: string): ScanState {
  let savedSession: Partial<ScanState> | null = null;
  if (typeof window !== 'undefined') {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (raw) savedSession = JSON.parse(raw);
    } catch {
      savedSession = null;
    }
  }

  const { step: hashStep, scanId: hashScanId } = parseHashRoute();
  const activeScanId = hashScanId || savedSession?.scanId || null;
  const initialFurthest: StepId = Math.max(
    (savedSession?.furthestStep as StepId) || 1,
    hashStep && activeScanId ? hashStep : 1
  ) as StepId;
  const initialCurrent: StepId =
    getInitialStepFromHash(initialFurthest) || (savedSession?.currentStep as StepId) || 1;

  const stepsDefault: Record<StepId, StepStatus> = {
    1: 'active',
    2: 'locked',
    3: 'locked',
    4: 'locked',
    5: 'locked',
    6: 'locked',
  };

  if (savedSession?.steps) {
    for (const key of [1, 2, 3, 4, 5, 6] as StepId[]) {
      if (savedSession.steps[key]) {
        stepsDefault[key] = savedSession.steps[key];
      }
    }
  }

  // If a scan was previously saved or hash indicates an active step, unlock prior steps
  if (activeScanId) {
    const maxUnlocked = Math.max(initialFurthest, initialCurrent);
    for (let s = 1; s <= maxUnlocked; s++) {
      if (s < maxUnlocked) {
        stepsDefault[s as StepId] = 'done';
      } else if (stepsDefault[s as StepId] === 'locked') {
        stepsDefault[s as StepId] = 'active';
      }
    }
  }

  return {
    targetId: savedTargetId || savedSession?.targetId || null,
    targetUrl: savedTargetUrl || savedSession?.targetUrl || null,
    scanId: savedSession?.scanId || null,
    profile: (savedSession?.profile as ScanProfile) || 'standard',
    steps: stepsDefault,
    currentStep: initialCurrent,
    furthestStep: initialFurthest,
    crawl: savedSession?.crawl || { pages: 0, queue: 0 },
    endpoints: savedSession?.endpoints || [],
    plan: savedSession?.plan || [],
    rawFlags: savedSession?.rawFlags || [],
    verdicts: savedSession?.verdicts || [],
    roadmap: savedSession?.roadmap || { nodes: [], score: 0 },
    requests: savedSession?.requests || [],
    kpis: savedSession?.kpis || {
      riskScore: null,
      confirmed: 0,
      highSeverity: 0,
      endpoints: 0,
      durationSec: null,
    },
    scanStartedAt: savedSession?.scanStartedAt || null,
    scanCompletedAt: savedSession?.scanCompletedAt || null,
    scanStatus: (savedSession?.scanStatus as ScanState['scanStatus']) || 'idle',
    error: null,
    toast: null,
    retestHistory: savedSession?.retestHistory || [],
    sseStatus: 'disconnected',
    backendOnline: true,
    terminalLogs: [
      {
        id: 'init-1',
        tag: 'SYSTEM',
        text: 'NikSpider Command Center initialized.',
        ts: new Date().toLocaleTimeString(),
      },
      {
        id: 'init-2',
        tag: 'INFO',
        text: 'Engine online. Step 1 (Scan Center) ready.',
        ts: new Date().toLocaleTimeString(),
      },
    ],
  };
}

let logSeq = 1;
function makeLog(tag: TerminalLogLine['tag'], text: string): TerminalLogLine {
  return {
    id: `log-${Date.now()}-${logSeq++}`,
    tag,
    text,
    ts: new Date().toLocaleTimeString(),
  };
}

let toastSeq = 1;
function makeToast(message: string, type: ScanToast['type'] = 'info', actionStep?: StepId): ScanToast {
  return {
    id: `toast-${Date.now()}-${toastSeq++}`,
    message,
    type,
    actionStep,
  };
}

export function scanReducer(state: ScanState, action: ScanAction): ScanState {
  switch (action.type) {
    case 'SET_TARGET': {
      return {
        ...state,
        targetId: action.payload.targetId,
        targetUrl: action.payload.targetUrl,
      };
    }

    case 'SET_PROFILE': {
      return {
        ...state,
        profile: action.payload,
      };
    }

    case 'START_SCAN_REQUEST': {
      const nextSteps = { ...state.steps, 1: 'running' as StepStatus };
      return {
        ...state,
        scanStatus: 'starting',
        error: null,
        steps: nextSteps,
        terminalLogs: [
          ...state.terminalLogs,
          makeLog('CMD', `scan start --profile=${state.profile}`),
          makeLog('INFO', `Dispatching scan request for target: ${state.targetUrl || state.targetId}`),
        ],
      };
    }

    case 'START_SCAN_SUCCESS': {
      const scanId = action.payload.scanId;
      const nextSteps: Record<StepId, StepStatus> = {
        ...state.steps,
        1: 'done',
        2: 'running',
      };
      const now = Date.now();
      return {
        ...state,
        scanId,
        scanStatus: 'running',
        scanStartedAt: now,
        scanCompletedAt: null,
        steps: nextSteps,
        currentStep: 2,
        furthestStep: Math.max(state.furthestStep, 2) as StepId,
        crawl: { pages: 0, queue: 0 },
        plan: [],
        rawFlags: [],
        verdicts: [],
        roadmap: { nodes: [], score: 0 },
        requests: [],
        kpis: {
          riskScore: null,
          confirmed: 0,
          highSeverity: 0,
          endpoints: 0,
          durationSec: 0,
        },
        toast: makeToast('Step 1 complete. Moving to Step 2: Discovering endpoints', 'info'),
        terminalLogs: [
          ...state.terminalLogs,
          makeLog('SYSTEM', `Scan ${scanId.slice(0, 8)} started in [${state.profile.toUpperCase()}] profile.`),
          makeLog('INFO', 'Stage 1 Intake & Target Verification complete.'),
          makeLog('INFO', 'Stage 2 SpiderEyes surface crawl started.'),
        ],
      };
    }

    case 'START_SCAN_ERROR': {
      const nextSteps = { ...state.steps, 1: 'active' as StepStatus };
      return {
        ...state,
        scanStatus: 'error',
        error: action.payload,
        steps: nextSteps,
        toast: makeToast(action.payload, 'error'),
        terminalLogs: [
          ...state.terminalLogs,
          makeLog('ERROR', `Failed to start scan: ${action.payload}`),
        ],
      };
    }

    case 'SSE_EVENT': {
      const ev = action.payload;

      switch (ev.type) {
        case 'crawl_progress': {
          const pages = Number(ev.pages ?? 0);
          const queue = Number(ev.queue ?? 0);
          const newEndpoints = state.endpoints.slice();
          if (ev.url && !newEndpoints.includes(ev.url)) {
            newEndpoints.push(ev.url);
          }
          const nextSteps: Record<StepId, StepStatus> = {
            ...state.steps,
            2: 'running',
          };
          return {
            ...state,
            crawl: { pages, queue, url: ev.url },
            endpoints: newEndpoints,
            steps: nextSteps,
            kpis: {
              ...state.kpis,
              endpoints: Math.max(state.kpis.endpoints, pages, newEndpoints.length),
            },
            terminalLogs:
              pages > 0 && pages % 10 === 0
                ? [
                    ...state.terminalLogs,
                    makeLog('INFO', `Crawling surface: ${pages} pages discovered (${queue} in queue)`),
                  ]
                : state.terminalLogs,
          };
        }

        case 'plan_ready': {
          const nextSteps: Record<StepId, StepStatus> = {
            ...state.steps,
            2: 'done',
            3: 'running',
          };
          const nextFurthest = Math.max(state.furthestStep, 3) as StepId;
          const userViewingStep2 = state.currentStep === 2;
          const newCurrentStep = userViewingStep2 ? (3 as StepId) : state.currentStep;

          const toast = userViewingStep2
            ? makeToast('Step 2 complete. Moving to Step 3: Test for weaknesses', 'info')
            : makeToast('Step 2 finished. Surface mapping complete.', 'info', 3);

          return {
            ...state,
            plan: ev.plan || [],
            steps: nextSteps,
            furthestStep: nextFurthest,
            currentStep: newCurrentStep,
            toast,
            terminalLogs: [
              ...state.terminalLogs,
              makeLog('SYSTEM', `SpiderEyes crawl finished. Surface mapped.`),
              makeLog('INFO', `Test plan compiled with ${ev.plan?.length || 0} targeted routes.`),
              makeLog('INFO', 'Stage 3 SpiderPois live probe execution active.'),
            ],
          };
        }

        case 'raw_flag': {
          const exists = state.rawFlags.some((f) => f.id === ev.id);
          if (exists) return state;

          const updatedFlags = [
            ...state.rawFlags,
            { id: ev.id, module: ev.module, url: ev.url },
          ];

          return {
            ...state,
            rawFlags: updatedFlags,
            terminalLogs: [
              ...state.terminalLogs,
              makeLog('WARN', `Anomaly signal detected: ${ev.module.toUpperCase()} on ${ev.url}`),
            ],
          };
        }

        case 'triage_result': {
          const exists = state.verdicts.some((v) => v.id === ev.id);
          const updatedVerdicts = exists
            ? state.verdicts.map((v) => (v.id === ev.id ? { ...v, ...ev } : v))
            : [...state.verdicts, ev];

          const isConfirmed = ev.verdict === 'confirmed';
          const isHighOrCrit =
            isConfirmed && (ev.severity === 'Critical' || ev.severity === 'High');

          const confirmedCount = updatedVerdicts.filter((v) => v.verdict === 'confirmed').length;
          const highSevCount = updatedVerdicts.filter(
            (v) => v.verdict === 'confirmed' && (v.severity === 'Critical' || v.severity === 'High')
          ).length;

          // Transition step 3 to done, step 4 to running on the first triage result
          const step3Finishing = state.steps[3] === 'running';
          const nextSteps: Record<StepId, StepStatus> = {
            ...state.steps,
            3: 'done',
            4: 'running',
          };
          const nextFurthest = Math.max(state.furthestStep, 4) as StepId;

          let newCurrentStep = state.currentStep;
          let toast = state.toast;

          if (step3Finishing) {
            if (state.currentStep === 3) {
              newCurrentStep = 4;
              toast = makeToast('Step 3 complete. Moving to Step 4: Validate evidence', 'info');
            } else if (state.currentStep < 3) {
              toast = makeToast('Step 3 finished. Live probes triaged.', 'info', 4);
            }
          }

          const logTag = isConfirmed ? 'FLAG' : 'INFO';
          const logText = isConfirmed
            ? `CONFIRMED: [${ev.severity.toUpperCase()}] ${ev.module || ev.owasp} on ${ev.url}`
            : `REJECTED: False positive filtered for ${ev.module || 'probe'} on ${ev.url}`;

          return {
            ...state,
            verdicts: updatedVerdicts,
            steps: nextSteps,
            furthestStep: nextFurthest,
            currentStep: newCurrentStep,
            toast,
            kpis: {
              ...state.kpis,
              confirmed: confirmedCount,
              highSeverity: highSevCount,
            },
            terminalLogs: [...state.terminalLogs, makeLog(logTag, logText)],
          };
        }

        case 'roadmap_ready': {
          const nextSteps: Record<StepId, StepStatus> = {
            ...state.steps,
            3: 'done',
            4: 'done',
            5: 'done',
            6: 'active',
          };
          const nextFurthest = 6 as StepId;
          const now = Date.now();

          // Step 5 is a hand-off: auto-advance there, then WAIT for the user (no auto step 6).
          let newCurrentStep = state.currentStep;
          let toast: ScanToast | null = null;

          if (state.currentStep <= 4) {
            newCurrentStep = 5;
            toast = makeToast('Step 4 complete. Moving to Step 5: Fix Roadmap', 'success');
          } else {
            toast = makeToast('Remediation Roadmap ready. Step 5 unlocked.', 'success', 5);
          }

          return {
            ...state,
            scanStatus: 'completed',
            scanCompletedAt: now,
            steps: nextSteps,
            furthestStep: nextFurthest,
            currentStep: newCurrentStep,
            toast,
            kpis: {
              ...state.kpis,
              riskScore: typeof ev.score === 'number' ? ev.score : state.kpis.riskScore,
            },
            terminalLogs: [
              ...state.terminalLogs,
              makeLog('SYSTEM', `SpiderBrain roadmap compiled (${ev.nodes || 0} clustered nodes).`),
              makeLog('SYSTEM', `Target Risk Score: ${ev.score ?? 0}/100.`),
              makeLog('INFO', 'Step 5 ready: Review root-cause roadmap and copy fix prompts.'),
            ],
          };
        }

        case 'retest_result': {
          const updatedNodes = state.roadmap.nodes.map((n) => {
            if (n.id === ev.id || n.finding_ids?.includes(ev.id)) {
              return { ...n, status: ev.passed ? ('fixed' as const) : n.status };
            }
            return n;
          });

          return {
            ...state,
            roadmap: {
              ...state.roadmap,
              nodes: updatedNodes,
              score: ev.score ?? state.roadmap.score,
            },
            kpis: {
              ...state.kpis,
              riskScore: ev.score ?? state.kpis.riskScore,
            },
            terminalLogs: [
              ...state.terminalLogs,
              makeLog(
                ev.passed ? 'INFO' : 'WARN',
                `Retest for finding ${ev.id.slice(0, 8)}: ${ev.passed ? 'FIXED' : 'STILL VULNERABLE'}`
              ),
            ],
          };
        }

        case 'error': {
          const runningStep = (Object.keys(state.steps) as unknown as StepId[]).find(
            (k) => state.steps[k] === 'running'
          );
          const nextSteps = { ...state.steps };
          if (runningStep) {
            nextSteps[runningStep] = 'error';
          }

          return {
            ...state,
            scanStatus: 'error',
            error: ev.message,
            steps: nextSteps,
            toast: makeToast(ev.message, 'error'),
            terminalLogs: [
              ...state.terminalLogs,
              makeLog('ERROR', `Pipeline error: ${ev.message}`),
            ],
          };
        }

        default:
          return state;
      }
    }

    case 'SET_ROADMAP': {
      const rm = action.payload;
      const confirmed = rm.confirmed_count ?? state.kpis.confirmed;
      const highSev = (rm.nodes || []).filter(
        (n) => n.status === 'open' && (n.severity === 'Critical' || n.severity === 'High')
      ).length;

      return {
        ...state,
        roadmap: {
          nodes: rm.nodes || [],
          score: rm.score || 0,
        },
        kpis: {
          ...state.kpis,
          riskScore: rm.score,
          confirmed: Math.max(state.kpis.confirmed, confirmed),
          highSeverity: Math.max(state.kpis.highSeverity, highSev),
        },
      };
    }

    case 'SET_VERDICTS': {
      const verdicts = action.payload;
      const confirmed = verdicts.filter((v) => v.verdict === 'confirmed').length;
      const highSev = verdicts.filter(
        (v) => v.verdict === 'confirmed' && (v.severity === 'Critical' || v.severity === 'High')
      ).length;

      return {
        ...state,
        verdicts,
        kpis: {
          ...state.kpis,
          confirmed: Math.max(state.kpis.confirmed, confirmed),
          highSeverity: Math.max(state.kpis.highSeverity, highSev),
        },
      };
    }

    case 'SET_REQUESTS': {
      return {
        ...state,
        requests: action.payload,
      };
    }

    case 'RETEST_RESULT': {
      const { findingId, nodeId, passed, status, message, score } = action.payload;

      const historyItem: RetestLogItem = {
        id: `retest-${Date.now()}-${logSeq++}`,
        findingId,
        nodeId,
        passed,
        status,
        message,
        score,
        ts: new Date().toLocaleTimeString(),
      };

      const updatedNodes = state.roadmap.nodes.map((n) => {
        if (n.id === nodeId || n.finding_ids?.includes(findingId)) {
          return {
            ...n,
            status: passed ? ('fixed' as const) : n.status,
          };
        }
        return n;
      });

      const nextSteps: Record<StepId, StepStatus> = {
        ...state.steps,
        6: 'done',
      };

      const newScore = score ?? state.kpis.riskScore;

      return {
        ...state,
        steps: nextSteps,
        retestHistory: [historyItem, ...state.retestHistory],
        roadmap: {
          ...state.roadmap,
          nodes: updatedNodes,
          score: newScore ?? state.roadmap.score,
        },
        kpis: {
          ...state.kpis,
          riskScore: newScore,
        },
        toast: passed
          ? makeToast(`Finding ${findingId.slice(0, 8)} verified FIXED! Risk score updated.`, 'success')
          : makeToast(`Finding ${findingId.slice(0, 8)} still vulnerable.`, 'warn'),
        terminalLogs: [
          ...state.terminalLogs,
          makeLog(
            passed ? 'INFO' : 'WARN',
            `Retest result: ${status.toUpperCase()} (${findingId.slice(0, 8)}). ${message}`
          ),
        ],
      };
    }

    case 'UNLOCK_STEP': {
      const stepToUnlock = action.payload;
      const currentStatus = state.steps[stepToUnlock];
      const newStatus = currentStatus === 'locked' ? 'active' : currentStatus;
      const newFurthest = Math.max(state.furthestStep, stepToUnlock) as StepId;
      return {
        ...state,
        furthestStep: newFurthest,
        steps: {
          ...state.steps,
          [stepToUnlock]: newStatus,
        },
      };
    }

    case 'GO_TO_STEP': {
      const targetStep = action.payload;
      // Guard: Cannot jump to locked steps
      if (state.steps[targetStep] === 'locked' && targetStep > state.furthestStep) {
        return {
          ...state,
          toast: makeToast(`Complete step ${targetStep - 1} first`, 'warn'),
        };
      }

      if (typeof window !== 'undefined') {
        try {
          window.location.hash = `#/step/${targetStep}`;
        } catch {}
      }

      return {
        ...state,
        currentStep: targetStep,
      };
    }

    case 'SET_SSE_STATUS': {
      return {
        ...state,
        sseStatus: action.payload,
      };
    }

    case 'SET_BACKEND_ONLINE': {
      return {
        ...state,
        backendOnline: action.payload,
      };
    }

    case 'UPDATE_DURATION': {
      return {
        ...state,
        kpis: {
          ...state.kpis,
          durationSec: action.payload,
        },
      };
    }

    case 'DISMISS_TOAST': {
      return {
        ...state,
        toast: null,
      };
    }

    case 'CLEAR_TERMINAL_LOGS': {
      return {
        ...state,
        terminalLogs: [],
      };
    }

    case 'APPEND_TERMINAL_LOG': {
      return {
        ...state,
        terminalLogs: [
          ...state.terminalLogs,
          makeLog(action.payload.tag, action.payload.text),
        ],
      };
    }

    case 'RESET_SCAN': {
      return createInitialState(state.targetId || undefined, state.targetUrl || undefined);
    }

    default:
      return state;
    }
}

// ═══════════════════════════════════════════════════════════════════
// SINGLETON OBSERVABLE STORE WITH PERSISTENCE
// ═══════════════════════════════════════════════════════════════════
class ScanStore {
  private state: ScanState;
  private listeners = new Set<() => void>();

  constructor() {
    this.state = createInitialState();
  }

  public getState = (): ScanState => {
    return this.state;
  };

  public dispatch = (action: ScanAction): void => {
    const prevState = this.state;
    this.state = scanReducer(this.state, action);

    // Save session storage on state changes
    if (typeof window !== 'undefined' && this.state !== prevState) {
      try {
        const payloadToPersist = {
          targetId: this.state.targetId,
          targetUrl: this.state.targetUrl,
          scanId: this.state.scanId,
          profile: this.state.profile,
          steps: this.state.steps,
          currentStep: this.state.currentStep,
          furthestStep: this.state.furthestStep,
          crawl: this.state.crawl,
          endpoints: this.state.endpoints,
          plan: this.state.plan,
          rawFlags: this.state.rawFlags,
          verdicts: this.state.verdicts,
          roadmap: this.state.roadmap,
          requests: this.state.requests,
          kpis: this.state.kpis,
          scanStartedAt: this.state.scanStartedAt,
          scanCompletedAt: this.state.scanCompletedAt,
          scanStatus: this.state.scanStatus,
          retestHistory: this.state.retestHistory,
        };
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(payloadToPersist));
      } catch {}
    }

    this.listeners.forEach((listener) => listener());
  };

  public subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
}

export const scanStore = new ScanStore();

export function useScanStore<T>(selector: (state: ScanState) => T): T {
  return useSyncExternalStore(scanStore.subscribe, () => selector(scanStore.getState()));
}

