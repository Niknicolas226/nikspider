export type StepId = 1 | 2 | 3 | 4 | 5 | 6;

export type StepStatus = 'locked' | 'active' | 'running' | 'done' | 'error';

export interface StepConfig {
  id: StepId;
  name: string;
  shortLabel: string;
  cluster: string;
  whatYouDoNow: string;
  reportTitle: string;
  reportDescription: string;
}

export const STEPS: readonly StepConfig[] = [
  {
    id: 1,
    name: 'Scan Center',
    shortLabel: 'Scan Setup',
    cluster: 'Orchestrator Core',
    whatYouDoNow: 'Pick a policy profile budget and initiate autonomous assessment against verified target.',
    reportTitle: 'Scan Configuration & Policy Profile',
    reportDescription: 'Initial scan setup, target verification status, and chosen probe budget.',
  },
  {
    id: 2,
    name: 'Endpoints',
    shortLabel: 'Endpoints',
    cluster: 'SpiderEyes',
    whatYouDoNow: 'Deep discovery and mapping of accessible pages, API routes, and parameter surfaces.',
    reportTitle: 'Discovered Attack Surface & Endpoints',
    reportDescription: 'Catalog of crawled pages, query parameters, and discovered API routes.',
  },
  {
    id: 3,
    name: 'Live Scan Feed',
    shortLabel: 'Live Probes',
    cluster: 'SpiderPois',
    whatYouDoNow: 'Executing non-destructive differential probes across all target endpoints.',
    reportTitle: 'Test Plan, Raw Signals & Request Logs',
    reportDescription: 'Executed test plan, initial anomalous signals, and full HTTP audit logs.',
  },
  {
    id: 4,
    name: 'Agent Debater',
    shortLabel: 'Agent Debater',
    cluster: 'SpiderWeb',
    whatYouDoNow: 'Multi-agent adversarial debate to validate evidence and eliminate false positives.',
    reportTitle: 'Triage Verdicts & Evidence Arguments',
    reportDescription: 'Confirmed vs. rejected findings with side-by-side evidence and OWASP mappings.',
  },
  {
    id: 5,
    name: 'Roadmap Creator',
    shortLabel: 'Fix Roadmap',
    cluster: 'SpiderBrain',
    whatYouDoNow: 'Deduplicated root-cause remediation roadmap generated. Review and copy fix prompts.',
    reportTitle: 'Remediation Directed Acyclic Graph (DAG)',
    reportDescription: 'Root-cause clustered fix nodes ordered from Critical to Low priority.',
  },
  {
    id: 6,
    name: 'Retest & Verify',
    shortLabel: 'Retest & Verify',
    cluster: 'Close The Loop',
    whatYouDoNow: 'Execute live retests against target endpoints to verify fixes and drive risk to zero.',
    reportTitle: 'Remediation Verification & Live Posture',
    reportDescription: 'Live retest verification results, patch status, and updated risk score.',
  },
] as const;

export function getStepConfig(id: StepId): StepConfig {
  const found = STEPS.find((s) => s.id === id);
  if (!found) return STEPS[0];
  return found;
}

