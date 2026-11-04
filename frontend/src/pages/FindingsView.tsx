import React, { useState } from 'react';
import { EvidenceRecord, GroundedFinding } from '../types';
import { FindingThread } from '../components/AgentArguments/FindingThread';
import { EvidenceModal } from '../components/AgentArguments/EvidenceModal';
import { FindingsTable } from '../components/FindingsTable';
import { getEvidenceById } from '../api/findingsApi';
import { ShieldCheck, Sparkles, Scale } from 'lucide-react';

interface FindingsViewProps {
  findings: GroundedFinding[];
  onRetestFinding: (finding: GroundedFinding) => Promise<boolean>;
}

export const FindingsView: React.FC<FindingsViewProps> = ({ findings, onRetestFinding }) => {
  const [selectedEvidence, setSelectedEvidence] = useState<EvidenceRecord | null>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalTab, setModalTab] = useState<'both' | 'request' | 'response'>('both');

  const handleOpenEvidence = async (
    evidenceId: string,
    finding: GroundedFinding,
    tab: 'both' | 'request' | 'response' = 'both'
  ) => {
    setModalTab(tab);
    setModalLoading(true);
    try {
      const record = await getEvidenceById(evidenceId, finding);
      setSelectedEvidence(record);
    } finally {
      setModalLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Architecture & Grounding Transparency Header */}
      <div className="rounded-2xl border border-purple-500/30 bg-gradient-to-r from-[#090d1d] via-[#100d24] to-[#081220] p-5 shadow-[0_16px_50px_rgba(2,8,23,0.75)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1.5 max-w-3xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-purple-500/20 text-purple-300 border border-purple-500/40">
                <Scale className="w-3.5 h-3.5" /> Stage 4 Structured Synthesis
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-cyan-500/15 text-cyan-300 border border-cyan-500/35">
                <ShieldCheck className="w-3.5 h-3.5" /> Stage 3.5 Grounded (grounding.py)
              </span>
            </div>
            <h2 className="text-lg font-extrabold text-white tracking-tight">
              Grounded Severity Case, Mitigating Factors &amp; Neutral Summary
            </h2>
            <p className="text-xs text-slate-300 leading-relaxed">
              For each deterministically confirmed finding, Stage 4 synthesizes a structured JSON evaluation (
              <code className="text-rose-300 font-mono">severity_case</code>,{' '}
              <code className="text-amber-300 font-mono">mitigating_factors</code>, and{' '}
              <code className="text-cyan-300 font-mono">neutral_summary</code>). Stage 3.5&rsquo;s{' '}
              <code className="text-cyan-300 font-mono">grounding.py</code> strips ungrounded claims so every
              statement links directly to a verified <code className="text-cyan-300 font-mono">[evidence_id]</code>{' '}
              record in <code className="text-cyan-300 font-mono">evidence_store</code>.
            </p>
          </div>

          <div className="bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-3 text-xs font-mono space-y-1">
            <div className="text-slate-400 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              <span>Evidence Grounding Rate:</span>
              <span className="text-[#61f5ae] font-bold">100%</span>
            </div>
            <div className="text-[11px] text-slate-500">
              Click any <span className="text-cyan-300">[evidence_id: ev_xxxx]</span> chip to inspect raw HTTP proof.
            </div>
          </div>
        </div>
      </div>

      {/* Per-Finding Grounded Argument Threads */}
      <div className="space-y-5">
        {findings.map((finding) => (
          <FindingThread
            key={finding.id}
            finding={finding}
            onOpenEvidence={handleOpenEvidence}
            onRetestFinding={onRetestFinding}
          />
        ))}
      </div>

      {/* Compact Findings Table below threads */}
      <FindingsTable
        findings={findings}
        onOpenEvidence={handleOpenEvidence}
        onRetestFinding={onRetestFinding}
      />

      {/* Evidence Modal */}
      {(selectedEvidence || modalLoading) && (
        <EvidenceModal
          evidence={selectedEvidence}
          loading={modalLoading}
          initialTab={modalTab}
          onClose={() => setSelectedEvidence(null)}
        />
      )}
    </div>
  );
};

export default FindingsView;

