export type Severity = 'Critical' | 'High' | 'Medium' | 'Low';
export type SeverityLower = 'critical' | 'high' | 'medium' | 'low';
export type ScanProfile = 'safe' | 'standard' | 'aggressive';

export type TriageVerdict = 'confirmed' | 'rejected' | 'needs_more_evidence';

export interface Target {
  id: string;
  url: string;
  token: string;
  verified: boolean;
}

export interface PlanItem {
  url: string;
  checks: string[];
  why: string;
}

export interface RawFlag {
  id: string;
  module: string;
  url: string;
}

export interface FindingEvidence {
  request: string;
  response_excerpt: string;
  signal: string;
}

export interface TriageResult {
  id: string;
  module?: string;
  url?: string;
  param?: string;
  verdict: TriageVerdict;
  severity: Severity;
  owasp: string;
  confidence: number;
  reason: string;
  evidence_quote?: string;
  rule_check?: string;
  agent_a?: string;
  agent_b?: string;
  pros?: string[];
  cons?: string[];
  evidence: FindingEvidence;
}

export interface RoadmapNode {
  id: string;
  issue: string;
  severity: Severity;
  owasp: string;
  root_cause: string;
  affects: string[];
  fix_steps: string[];
  code_example: string;
  verify: string;
  resolves_count: number;
  status: 'open' | 'fixed';
  finding_ids: string[];
  children?: RoadmapNode[];
  effort?: 'S' | 'M' | 'L';
  blocks?: string[];
  impact_score?: number;
  fixed_at?: string | null;
  retest_history?: Array<{
    timestamp: string;
    passed: boolean;
    status: string;
    finding_id?: string;
    message?: string;
  }>;
}

export interface DebateJudge {
  verdict: TriageVerdict | string;
  severity: Severity;
  owasp: string;
  confidence: number;
  reason: string;
  evidence_quote?: string;
}

export interface DebateTranscript {
  finding_id: string;
  module?: string;
  url?: string;
  param?: string;
  prosecutor: string;
  defender: string;
  judge: DebateJudge;
  enforcement_overrides: string[];
  rule_check?: string;
  pros: string[];
  cons: string[];
  evidence: FindingEvidence;
}

export interface RoadmapResponse {
  score: number;
  raw_count: number;
  confirmed_count: number;
  rejected_count: number;
  nodes: RoadmapNode[];
}

export interface RequestLogEntry {
  id: number;
  scan_id: string;
  ts: string;
  method: string;
  url: string;
  status: number | null;
}

export interface RetestApiResult {
  passed: boolean;
  status: string;
  message: string;
  score?: number;
}

export type SSEEvent =
  | { type: 'crawl_progress'; pages: number; queue: number; url?: string }
  | { type: 'plan_ready'; plan: PlanItem[] }
  | { type: 'probe_started'; module: string; url: string }
  | { type: 'raw_flag'; id: string; module: string; url: string }
  | ({ type: 'triage_result' } & TriageResult)
  | { type: 'roadmap_ready'; nodes: number; score: number }
  | { type: 'retest_result'; id: string; passed: boolean; score?: number }
  | { type: 'scan_control'; status: 'paused' | 'running' | 'stopped' }
  | { type: 'error'; message: string };

// Preserved types for auxiliary components
export type TerminalEventType =
  | 'connected'
  | 'stage_started'
  | 'stage_completed'
  | 'crawl_complete'
  | 'surface_mapped'
  | 'probe_started'
  | 'signal'
  | 'reprobing'
  | 'confirmed'
  | 'rejected'
  | 'scan_complete';

export interface ScanSocketEvent {
  ts: string;
  scan_id?: string;
  stage: string;
  type: TerminalEventType | string;
  module: string | null;
  endpoint: string | null;
  severity: SeverityLower | null;
  message?: string;
}

export interface TerminalLineItem {
  id: string;
  ts: string;
  stage: string;
  prefix: '>' | '✓' | '→' | '⚠' | '✗';
  tone: 'prompt' | 'success' | 'info' | 'warning' | 'danger' | 'confirmed';
  text: string;
  module?: string | null;
  endpoint?: string | null;
  severity?: SeverityLower | null;
}

export interface GroundedFinding {
  id: string;
  scan_id?: string;
  evidence_id: string;
  module: string;
  url: string;
  endpoint: string;
  param: string;
  severity: SeverityLower;
  verdict: TriageVerdict;
  status: 'confirmed' | 'fixed' | 'raw';
  owasp: string;
  confidence: number;
  signal: string;
  reason: string;
  request: string;
  response: string;
  severity_case: string;
  mitigating_factors: string;
  neutral_summary: string;
  fix?: string;
  snippet?: string;
}

export interface EvidenceRecord {
  evidence_id: string;
  finding_id: string;
  module: string;
  endpoint: string;
  param?: string;
  severity: SeverityLower;
  owasp: string;
  signal: string;
  ts: string;
  request: string;
  response: string;
  sha256: string;
  verified: boolean;
}

export type ExportFormat = 'md' | 'pdf' | 'sarif' | 'json';
