import { TriageResult, Severity, TriageVerdict } from '../types';

export type DebaterSortOption = 'severity' | 'confidence' | 'owasp';
export type DebaterFilterTab = 'all' | 'confirmed' | 'rejected' | 'needs_more_evidence';

export const SEVERITY_WEIGHTS: Record<Severity, number> = {
  Critical: 4,
  High: 3,
  Medium: 2,
  Low: 1,
};

export function filterAndSortFindings(
  findings: TriageResult[],
  filter: DebaterFilterTab,
  sortBy: DebaterSortOption,
  searchQuery: string
): TriageResult[] {
  let list = findings;

  // Filter tab
  if (filter !== 'all') {
    list = list.filter((f) => f.verdict === filter);
  }

  // Search query
  const query = searchQuery.trim().toLowerCase();
  if (query) {
    list = list.filter((f) => {
      const matchMod = (f.module || '').toLowerCase().includes(query);
      const matchUrl = (f.url || '').toLowerCase().includes(query);
      const matchParam = (f.param || '').toLowerCase().includes(query);
      const matchOwasp = (f.owasp || '').toLowerCase().includes(query);
      return matchMod || matchUrl || matchParam || matchOwasp;
    });
  }

  // Sort
  const sorted = [...list].sort((a, b) => {
    if (sortBy === 'severity') {
      const wA = SEVERITY_WEIGHTS[a.severity] ?? 0;
      const wB = SEVERITY_WEIGHTS[b.severity] ?? 0;
      if (wA !== wB) return wB - wA;
      return (b.confidence ?? 0) - (a.confidence ?? 0);
    }
    if (sortBy === 'confidence') {
      const cA = a.confidence ?? 0;
      const cB = b.confidence ?? 0;
      if (cA !== cB) return cB - cA;
      return (SEVERITY_WEIGHTS[b.severity] ?? 0) - (SEVERITY_WEIGHTS[a.severity] ?? 0);
    }
    if (sortBy === 'owasp') {
      return (a.owasp || '').localeCompare(b.owasp || '');
    }
    return 0;
  });

  return sorted;
}

export function computeDebaterSummary(
  findings: TriageResult[],
  rawFlagsCount: number
): {
  rawFlags: number;
  confirmed: number;
  rejected: number;
  needsEvidence: number;
  falseAlarmsRemoved: number;
  estimatedMinutesSaved: number;
} {
  const confirmed = findings.filter((f) => f.verdict === 'confirmed').length;
  const rejected = findings.filter((f) => f.verdict === 'rejected').length;
  const needsEvidence = findings.filter((f) => f.verdict === 'needs_more_evidence').length;
  const totalTriaged = findings.length;

  // Each triaged finding saves ~12 minutes of manual AppSec analyst investigation
  const estimatedMinutesSaved = totalTriaged * 12;

  return {
    rawFlags: Math.max(rawFlagsCount, totalTriaged),
    confirmed,
    rejected,
    needsEvidence,
    falseAlarmsRemoved: rejected,
    estimatedMinutesSaved,
  };
}

export function getConfidenceColor(confidence: number): {
  bg: string;
  text: string;
  border: string;
  band: 'low' | 'medium' | 'high';
} {
  const pct = confidence > 1 ? confidence : Math.round(confidence * 100);
  if (pct < 50) {
    return {
      bg: 'bg-red-500/20',
      text: 'text-red-400',
      border: 'border-red-500/40',
      band: 'low',
    };
  }
  if (pct <= 80) {
    return {
      bg: 'bg-yellow-500/20',
      text: 'text-yellow-400',
      border: 'border-yellow-500/40',
      band: 'medium',
    };
  }
  return {
    bg: 'bg-emerald-500/20',
    text: 'text-emerald-400',
    border: 'border-emerald-500/40',
    band: 'high',
  };
}

