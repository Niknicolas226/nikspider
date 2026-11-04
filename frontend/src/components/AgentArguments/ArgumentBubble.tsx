import React from 'react';
import { GroundedText } from './EvidenceLink';

export type ArgumentKind = 'severity_case' | 'mitigating_factors' | 'neutral_summary';

interface ArgumentBubbleProps {
  kind: ArgumentKind;
  text: string;
  evidenceId: string;
  onSelectEvidence: (evidenceId: string) => void;
}

const BUBBLE_META: Record<
  ArgumentKind,
  {
    dot: string;
    label: string;
    fieldKey: string;
    border: string;
    bg: string;
    titleColor: string;
  }
> = {
  severity_case: {
    dot: '🔴',
    label: 'Severity Case',
    fieldKey: 'severity_case',
    border: 'border-rose-500/35 hover:border-rose-500/60',
    bg: 'bg-gradient-to-r from-rose-950/30 via-slate-900/80 to-slate-900/80',
    titleColor: 'text-rose-300',
  },
  mitigating_factors: {
    dot: '🟡',
    label: 'Mitigating Factors',
    fieldKey: 'mitigating_factors',
    border: 'border-amber-500/35 hover:border-amber-500/60',
    bg: 'bg-gradient-to-r from-amber-950/25 via-slate-900/80 to-slate-900/80',
    titleColor: 'text-amber-300',
  },
  neutral_summary: {
    dot: '⚪',
    label: 'Neutral Summary',
    fieldKey: 'neutral_summary',
    border: 'border-cyan-500/35 hover:border-cyan-500/60',
    bg: 'bg-gradient-to-r from-cyan-950/30 via-slate-900/85 to-slate-900/85',
    titleColor: 'text-slate-100',
  },
};

export const ArgumentBubble: React.FC<ArgumentBubbleProps> = ({
  kind,
  text,
  evidenceId,
  onSelectEvidence,
}) => {
  const meta = BUBBLE_META[kind];

  return (
    <div className={`rounded-xl border p-4 transition-all ${meta.border} ${meta.bg}`}>
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-2">
          <span className="text-sm select-none">{meta.dot}</span>
          <span className={`text-xs font-bold tracking-wide ${meta.titleColor}`}>{meta.label}</span>
        </div>
        <span className="text-[10px] font-mono text-slate-500 bg-slate-950/80 px-2 py-0.5 rounded border border-slate-800">
          {meta.fieldKey}
        </span>
      </div>

      <p className="text-xs text-slate-200 leading-relaxed pl-6">
        &ldquo;
        <GroundedText
          text={text}
          defaultEvidenceId={evidenceId}
          onSelectEvidence={onSelectEvidence}
        />
        &rdquo;
      </p>
    </div>
  );
};

export default ArgumentBubble;

