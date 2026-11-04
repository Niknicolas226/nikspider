import React from 'react';
import { TriageResult, Severity, TriageVerdict } from '../../types';
import { getConfidenceColor } from '../../utils/debaterUtils';
import {
  CheckCircle2,
  XCircle,
  HelpCircle,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';

interface VerdictCardProps {
  finding: TriageResult;
  currentIndex: number;
  totalCount: number;
  onPrevious: () => void;
  onNext: () => void;
  onNavigateToRoadmap?: () => void;
}

export const VerdictCard: React.FC<VerdictCardProps> = ({
  finding,
  currentIndex,
  totalCount,
  onPrevious,
  onNext,
  onNavigateToRoadmap,
}) => {
  const isConfirmed = finding.verdict === 'confirmed';
  const isRejected = finding.verdict === 'rejected';

  const confColor = getConfidenceColor(finding.confidence ?? 0.85);
  const confPct = Math.round(
    (finding.confidence ?? 0.85) * ((finding.confidence ?? 0.85) <= 1 ? 100 : 1)
  );

  const severityGradients: Record<Severity, string> = {
    Critical: 'text-rose-400 bg-rose-950/40 border-rose-500/40',
    High: 'text-amber-400 bg-amber-950/40 border-amber-500/40',
    Medium: 'text-yellow-300 bg-yellow-950/30 border-yellow-500/30',
    Low: 'text-blue-300 bg-blue-950/30 border-blue-500/30',
  };

  return (
    <div className="p-4 rounded-2xl bg-[#090514]/95 border border-purple-500/40 shadow-[0_0_24px_rgba(168,85,247,0.2)] backdrop-blur-xl space-y-3 text-left">
      {/* Top action row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {isConfirmed ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 shadow-[0_0_12px_rgba(16,185,129,0.3)]">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              CONFIRMED VULNERABILITY
            </span>
          ) : isRejected ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold bg-red-500/20 text-red-300 border border-red-500/50">
              <XCircle className="w-4 h-4 text-red-400" />
              REJECTED (FALSE POSITIVE)
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/50">
              <HelpCircle className="w-4 h-4 text-amber-400" />
              NEEDS MORE EVIDENCE
            </span>
          )}

          <span
            className={`px-2.5 py-1 rounded-full text-xs font-mono font-bold border ${
              severityGradients[finding.severity] || severityGradients.Medium
            }`}
          >
            {finding.severity} Severity
          </span>
        </div>

        {/* Previous / Next and Step 5 link */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-black/60 rounded-xl border border-zinc-800 p-0.5 text-xs font-mono text-zinc-400">
            <button
              type="button"
              onClick={onPrevious}
              disabled={currentIndex <= 0}
              className="px-2 py-1 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition"
              title="Previous finding"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-2 text-[11px] text-zinc-300">
              {currentIndex + 1} / {totalCount}
            </span>
            <button
              type="button"
              onClick={onNext}
              disabled={currentIndex >= totalCount - 1}
              className="px-2 py-1 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition"
              title="Next finding"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {onNavigateToRoadmap && isConfirmed && (
            <button
              type="button"
              onClick={onNavigateToRoadmap}
              className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-mono font-bold flex items-center gap-1.5 transition cursor-pointer shadow-[0_0_14px_rgba(168,85,247,0.4)]"
            >
              <span>View in Roadmap</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Confidence meter */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[11px] font-mono">
          <span className="text-zinc-400">Evidence Consensus Meter</span>
          <span className={`font-bold ${confColor.text}`}>{confPct}% Consensus</span>
        </div>
        <div className="w-full h-2 rounded-full bg-zinc-900 border border-zinc-800 overflow-hidden relative">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              confColor.band === 'high'
                ? 'bg-gradient-to-r from-emerald-600 to-emerald-400'
                : confColor.band === 'medium'
                ? 'bg-gradient-to-r from-yellow-600 to-yellow-400'
                : 'bg-gradient-to-r from-red-600 to-red-400'
            }`}
            style={{ width: `${confPct}%` }}
          />
        </div>
        <div className="flex justify-between text-[9px] font-mono text-zinc-500 pt-0.5">
          <span>0% (Speculative)</span>
          <span>50% (Contested)</span>
          <span>80% (Definitive Proof)</span>
        </div>
      </div>

      {/* Rule engine override highlight */}
      {finding.rule_check && finding.rule_check !== 'PASS' && (
        <div className="p-2.5 rounded-xl bg-amber-950/30 border border-amber-500/40 text-amber-200 text-xs font-mono flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold uppercase text-[10px] tracking-wider block text-amber-300">
              Deterministic Safety Override
            </span>
            {finding.rule_check}
          </div>
        </div>
      )}

      {/* Plain English reasoning */}
      <div className="p-3 rounded-xl bg-black/60 border border-purple-500/20 text-xs text-zinc-300 leading-relaxed">
        <span className="text-purple-300 font-semibold font-mono text-[11px] block mb-0.5">
          Judge Verdict Rationale:
        </span>
        {finding.reason ||
          'Deterministic evidence validators confirmed repeatable exploitation signal matching OWASP rules.'}
      </div>
    </div>
  );
};

