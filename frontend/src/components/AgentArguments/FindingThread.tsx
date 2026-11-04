import React, { useState } from 'react';
import { GroundedFinding } from '../../types';
import { ArgumentBubble } from './ArgumentBubble';
import { FileSearch, Terminal, RefreshCw, CheckCircle2, Sparkles, Copy, Check } from 'lucide-react';

interface FindingThreadProps {
  finding: GroundedFinding;
  onOpenEvidence: (evidenceId: string, finding: GroundedFinding, tab?: 'both' | 'request' | 'response') => void;
  onRetestFinding?: (finding: GroundedFinding) => Promise<boolean>;
}

export const FindingThread: React.FC<FindingThreadProps> = ({
  finding,
  onOpenEvidence,
  onRetestFinding,
}) => {
  const [retesting, setRetesting] = useState(false);
  const [fixed, setFixed] = useState(finding.status === 'fixed');
  const [copiedPrompt, setCopiedPrompt] = useState(false);

  const sevUpper = finding.severity.toUpperCase();
  const sevBadgeStyle =
    finding.severity === 'critical'
      ? 'bg-red-500/20 text-red-300 border-red-500/50 shadow-[0_0_12px_rgba(239,68,68,0.25)]'
      : finding.severity === 'high'
      ? 'bg-orange-500/20 text-orange-300 border-orange-500/50 shadow-[0_0_12px_rgba(249,115,22,0.22)]'
      : finding.severity === 'medium'
      ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
      : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';

  const handleRetest = async () => {
    if (!onRetestFinding) return;
    setRetesting(true);
    try {
      const ok = await onRetestFinding(finding);
      if (ok) setFixed(true);
    } finally {
      setRetesting(false);
    }
  };

  const handleCopyFixPrompt = () => {
    const prompt = [
      `### NikSpider Grounded Remediation Prompt (${finding.module.toUpperCase()} on ${finding.endpoint})`,
      `- **Evidence ID:** ${finding.evidence_id} (${finding.owasp})`,
      `- **Signal:** ${finding.signal}`,
      `- **Summary:** ${finding.neutral_summary}`,
      `- **Fix Action:** ${finding.fix || 'Apply parameterized queries / context-aware encoding.'}`,
      finding.snippet ? `\n\`\`\`python\n${finding.snippet}\n\`\`\`` : '',
    ].join('\n');
    navigator.clipboard.writeText(prompt);
    setCopiedPrompt(true);
    setTimeout(() => setCopiedPrompt(false), 2000);
  };

  return (
    <div
      className={`rounded-2xl border transition-all overflow-hidden ${
        fixed
          ? 'bg-emerald-950/15 border-emerald-500/40 shadow-[0_0_25px_rgba(16,185,129,0.12)]'
          : 'bg-[#080d1a]/95 border-cyan-500/25 shadow-[0_16px_50px_rgba(2,8,23,0.75)]'
      }`}
    >
      {/* Top ASCII-style Frame Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 bg-[#0b1326] border-b border-slate-800/90">
        <div className="flex flex-wrap items-center gap-2.5 font-mono">
          <span className="text-cyan-400 font-bold select-none">┌─</span>
          <span className="text-sm font-extrabold text-white tracking-tight uppercase">
            {finding.module}
          </span>
          <span className="text-slate-500">—</span>
          <span className="text-sm text-cyan-300 font-semibold">{finding.endpoint}</span>
          {finding.param && (
            <span className="text-xs text-purple-300 bg-purple-950/60 border border-purple-500/30 px-2 py-0.5 rounded">
              param: {finding.param}
            </span>
          )}
          <span className={`text-xs font-bold px-2.5 py-0.5 rounded border ${sevBadgeStyle}`}>
            [{sevUpper}]
          </span>
          {fixed && (
            <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-[#61f5ae] border border-emerald-500/40">
              <CheckCircle2 className="w-3.5 h-3.5" /> VERIFIED FIXED
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 text-xs font-mono">
          <span className="text-slate-400 bg-slate-950 px-2.5 py-1 rounded border border-slate-800">
            {finding.owasp}
          </span>
          <span className="text-cyan-300 bg-cyan-950/50 px-2.5 py-1 rounded border border-cyan-800/60">
            Confidence: {Math.round(finding.confidence * 100)}%
          </span>
        </div>
      </div>

      {/* Grounded Argument Thread Body */}
      <div className="p-5 space-y-3.5">
        <ArgumentBubble
          kind="severity_case"
          text={finding.severity_case}
          evidenceId={finding.evidence_id}
          onSelectEvidence={(evId) => onOpenEvidence(evId, finding, 'both')}
        />

        <ArgumentBubble
          kind="mitigating_factors"
          text={finding.mitigating_factors}
          evidenceId={finding.evidence_id}
          onSelectEvidence={(evId) => onOpenEvidence(evId, finding, 'both')}
        />

        <ArgumentBubble
          kind="neutral_summary"
          text={finding.neutral_summary}
          evidenceId={finding.evidence_id}
          onSelectEvidence={(evId) => onOpenEvidence(evId, finding, 'both')}
        />

        {/* Bottom Action Bar matching spec: [View evidence ev_8f2a →] [View raw request →] */}
        <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-slate-800/80">
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => onOpenEvidence(finding.evidence_id, finding, 'both')}
              className="px-3.5 py-1.5 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/40 text-xs font-mono font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-[0_0_15px_rgba(34,211,238,0.12)]"
            >
              <FileSearch className="w-3.5 h-3.5" />
              <span>[View evidence {finding.evidence_id} →]</span>
            </button>

            <button
              type="button"
              onClick={() => onOpenEvidence(finding.evidence_id, finding, 'request')}
              className="px-3.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 text-xs font-mono flex items-center gap-1.5 transition cursor-pointer"
            >
              <Terminal className="w-3.5 h-3.5 text-purple-400" />
              <span>[View raw request →]</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleCopyFixPrompt}
              className="px-3 py-1.5 rounded-lg bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 border border-purple-500/35 text-xs font-mono flex items-center gap-1.5 transition cursor-pointer"
            >
              {copiedPrompt ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" /> Copied Fix Prompt
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" /> Copy AI Fix Prompt
                </>
              )}
            </button>

            {onRetestFinding && (
              <button
                type="button"
                onClick={handleRetest}
                disabled={retesting || fixed}
                className="px-3.5 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 disabled:opacity-50 text-[#61f5ae] border border-emerald-500/40 text-xs font-mono font-semibold flex items-center gap-1.5 transition cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${retesting ? 'animate-spin' : ''}`} />
                <span>{fixed ? 'Retest Passed ✓' : retesting ? 'Re-probing...' : '1-Click Retest'}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FindingThread;

