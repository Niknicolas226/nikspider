import React, { useState } from 'react';
import { RoadmapNode, Severity } from '../../types';
import { SEVERITY_SCORES } from '../../utils/roadmapUtils';
import {
  X,
  RotateCcw,
  Code,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Clock,
  Layers,
  ChevronRight,
  ShieldCheck,
  Zap,
} from 'lucide-react';

interface NodeDetailProps {
  node: RoadmapNode | null;
  onClose: () => void;
  onRetest: (node: RoadmapNode) => void;
  onOpenPromptBridge: (node: RoadmapNode) => void;
  onJumpToDebate: (findingId: string) => void;
  isRetesting: boolean;
}

export const NodeDetail: React.FC<NodeDetailProps> = ({
  node,
  onClose,
  onRetest,
  onOpenPromptBridge,
  onJumpToDebate,
  isRetesting,
}) => {
  const [completedSteps, setCompletedSteps] = useState<Record<number, boolean>>({});

  if (!node) return null;

  const isFixed = node.status === 'fixed';
  const impact = node.impact_score || SEVERITY_SCORES[node.severity] || 5;

  const severityBadgeColors: Record<Severity, string> = {
    Critical: 'text-rose-400 bg-rose-950/40 border-rose-500/40',
    High: 'text-amber-400 bg-amber-950/40 border-amber-500/40',
    Medium: 'text-yellow-300 bg-yellow-950/30 border-yellow-500/30',
    Low: 'text-blue-300 bg-blue-950/30 border-blue-500/30',
  };

  const toggleStep = (idx: number) => {
    setCompletedSteps((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-xl bg-[#0b0616] border-l border-purple-500/30 shadow-[-10px_0_40px_rgba(168,85,247,0.25)] flex flex-col text-left backdrop-blur-2xl animate-in slide-in-from-right duration-300">
      {/* Header */}
      <div className="p-5 border-b border-purple-500/20 bg-purple-950/30 flex items-start justify-between gap-3">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`px-2 py-0.5 rounded-full text-xs font-mono font-bold border ${
                severityBadgeColors[node.severity] || severityBadgeColors.Medium
              }`}
            >
              {node.severity}
            </span>
            <span className="px-2 py-0.5 rounded-full text-xs font-mono text-purple-300 bg-purple-950 border border-purple-500/30">
              {node.owasp}
            </span>
            <span className="px-2 py-0.5 rounded-full text-xs font-mono text-amber-300 bg-amber-950/60 border border-amber-500/30">
              Effort: {node.effort || 'M'}
            </span>
            <span className="px-2 py-0.5 rounded-full text-xs font-mono text-emerald-300 bg-emerald-950/60 border border-emerald-500/30 font-bold">
              -{impact} pts Risk
            </span>
          </div>

          <h3 className="text-base font-bold text-white leading-snug">{node.issue}</h3>
          <p className="text-xs text-zinc-400 font-mono">{node.root_cause}</p>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white transition cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Action Bar */}
      <div className="p-3 border-b border-zinc-800/80 bg-black/40 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => onRetest(node)}
          disabled={isRetesting}
          className="flex-1 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-mono font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer shadow-[0_0_14px_rgba(168,85,247,0.4)]"
        >
          <RotateCcw className={`w-3.5 h-3.5 ${isRetesting ? 'animate-spin' : ''}`} />
          <span>{isRetesting ? 'Re-probing Endpoint...' : isFixed ? 'Re-verify Fix' : '1-Click Retest'}</span>
        </button>

        <button
          type="button"
          onClick={() => onOpenPromptBridge(node)}
          className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-200 hover:text-white font-mono text-xs flex items-center gap-1.5 transition cursor-pointer"
        >
          <Code className="w-3.5 h-3.5 text-purple-400" />
          <span>Generate Fix Prompt</span>
        </button>
      </div>

      {/* Body content */}
      <div className="p-5 space-y-6 overflow-y-auto flex-1">
        {/* Fix Steps Checklist */}
        <div className="space-y-3">
          <h4 className="text-xs font-mono font-bold text-purple-300 uppercase tracking-wider flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-purple-400" />
            <span>Remediation Checklist</span>
          </h4>
          <div className="space-y-2">
            {(node.fix_steps || []).map((step, idx) => {
              const isChecked = Boolean(completedSteps[idx]);
              return (
                <div
                  key={idx}
                  onClick={() => toggleStep(idx)}
                  className={`p-3 rounded-xl border transition-all cursor-pointer flex items-start gap-3 ${
                    isChecked
                      ? 'bg-emerald-950/20 border-emerald-500/40 text-zinc-300'
                      : 'bg-black/40 border-zinc-800 text-zinc-200 hover:border-purple-500/40'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => {}}
                    className="mt-0.5 rounded bg-black border-zinc-700 text-purple-600 focus:ring-0 cursor-pointer"
                  />
                  <div className="text-xs font-mono leading-relaxed">
                    <span className="text-purple-400 font-bold mr-2">{idx + 1}.</span>
                    {step}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Code Before & After Diff Pattern */}
        {node.code_example && (
          <div className="space-y-2">
            <h4 className="text-xs font-mono font-bold text-cyan-300 uppercase tracking-wider flex items-center gap-2">
              <Code className="w-4 h-4 text-cyan-400" />
              <span>Recommended Code Implementation</span>
            </h4>
            <div className="p-3.5 rounded-xl bg-black/80 border border-zinc-800 overflow-x-auto">
              <pre className="text-xs font-mono text-zinc-300 whitespace-pre-wrap break-all">
                {node.code_example}
              </pre>
            </div>
          </div>
        )}

        {/* Affected Endpoints */}
        <div className="space-y-2">
          <h4 className="text-xs font-mono font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
            <Layers className="w-4 h-4 text-zinc-400" />
            <span>Affected Endpoints ({node.affects?.length || 0})</span>
          </h4>
          <div className="space-y-1.5">
            {(node.affects || []).map((endpoint, i) => (
              <div
                key={i}
                className="p-2.5 rounded-xl bg-black/60 border border-zinc-800/80 text-xs font-mono text-zinc-300 flex items-center justify-between"
              >
                <span className="truncate">{endpoint}</span>
                <span className="text-[10px] text-purple-400 shrink-0 ml-2">Active Target</span>
              </div>
            ))}
          </div>
        </div>

        {/* Trade-offs & Pros/Cons */}
        <div className="p-3.5 rounded-xl bg-purple-950/20 border border-purple-500/30 space-y-2">
          <h4 className="text-xs font-mono font-bold text-amber-300 flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            Remediation Considerations & Trade-offs
          </h4>
          <p className="text-xs text-zinc-300 leading-relaxed font-mono">
            Ensure input sanitization or parameterization is applied across all database drivers. If legacy API clients expect unencoded HTML or JSON strings, verify API response contracts to avoid backwards-incompatible breakage.
          </p>
        </div>

        {/* Jump to Debate Link */}
        {node.finding_ids && node.finding_ids.length > 0 && (
          <div className="p-3.5 rounded-xl bg-black/60 border border-zinc-800 flex items-center justify-between gap-3">
            <div>
              <div className="text-xs font-bold text-white font-mono">
                View Grounded Evidence Debate
              </div>
              <div className="text-[11px] text-zinc-400">
                Inspect prosecutor vs defender arguments for this finding in Step 4.
              </div>
            </div>
            <button
              type="button"
              onClick={() => onJumpToDebate(node.finding_ids[0])}
              className="px-3 py-1.5 rounded-lg bg-purple-600/30 hover:bg-purple-600/50 border border-purple-400/40 text-purple-200 text-xs font-mono flex items-center gap-1 transition cursor-pointer"
            >
              <span>View Debate</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Retest Verification Criteria */}
        <div className="space-y-2">
          <h4 className="text-xs font-mono font-bold text-emerald-300 uppercase tracking-wider flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Retest Probe Verification Criteria</span>
          </h4>
          <div className="p-3 rounded-xl bg-emerald-950/20 border border-emerald-500/30 text-xs font-mono text-zinc-300">
            {node.verify ||
              'Re-executes original probing vector. A passing verdict requires HTTP 200 without payload reflection or SQL error signatures.'}
          </div>
        </div>

        {/* Retest History Log */}
        {node.retest_history && node.retest_history.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-mono font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
              <Clock className="w-4 h-4 text-zinc-400" />
              <span>Retest Execution History</span>
            </h4>
            <div className="space-y-1.5">
              {node.retest_history.map((h, i) => (
                <div
                  key={i}
                  className="p-2.5 rounded-xl bg-black/60 border border-zinc-800 text-xs font-mono flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        h.passed ? 'bg-emerald-400' : 'bg-red-400'
                      }`}
                    />
                    <span className="text-zinc-200">{h.status.toUpperCase()}</span>
                    <span className="text-zinc-500 text-[10px]">{h.message}</span>
                  </div>
                  <span className="text-[10px] text-zinc-500">{new Date(h.timestamp).toLocaleTimeString()}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

