import React, { useState } from 'react';
import { useScanStore } from '../store/scanStore';
import { StepNavFooter } from './StepNavFooter';
import { DebatePanel } from './DebatePanel';
import { CheckCircle2, XCircle, AlertTriangle, Scale, Loader2, Sparkles } from 'lucide-react';

export const StepAgentDebaterView: React.FC = () => {
  const verdicts = useScanStore((s) => s.verdicts);
  const isRunning = useScanStore((s) => s.steps[4] === 'running');
  const isDone = useScanStore((s) => s.steps[4] === 'done');

  const confirmedCount = verdicts.filter((v) => v.verdict === 'confirmed').length;
  const rejectedCount = verdicts.filter((v) => v.verdict === 'rejected').length;

  return (
    <div className="space-y-6 text-left">
      {/* ═══════════════════════════════════════════════════════════════════
          HEADER & ABLATION METRICS
      ═══════════════════════════════════════════════════════════════════ */}
      <div className="p-5 rounded-2xl bg-[#090514]/90 border border-purple-500/30 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-purple-600/30 border border-purple-400/40 text-purple-200 text-xs font-mono font-bold flex items-center justify-center">
              4
            </span>
            <h3 className="text-base font-bold text-white">
              SpiderWeb — Agent Debater & Evidence Triage
            </h3>
            {isRunning && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-mono bg-purple-500/15 text-purple-300 border border-purple-400 animate-pulse">
                <Loader2 className="w-3 h-3 animate-spin" /> Adversarial Debate Active
              </span>
            )}
            {isDone && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-mono bg-emerald-500/15 text-emerald-300 border border-emerald-500/40 font-semibold">
                ✓ Triaged All Signals
              </span>
            )}
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            2-Agent debate: Agent A prosecutes severity vs. Agent B defending mitigating factors.
          </p>
        </div>

        <div className="flex items-center gap-3 font-mono text-xs">
          <div className="px-3.5 py-2 rounded-xl bg-emerald-950/40 border border-emerald-500/40 flex items-center gap-1.5 text-emerald-300">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>Confirmed: {confirmedCount}</span>
          </div>

          <div className="px-3.5 py-2 rounded-xl bg-red-950/30 border border-red-500/30 flex items-center gap-1.5 text-red-300">
            <XCircle className="w-4 h-4 text-red-400" />
            <span>Filtered Out: {rejectedCount}</span>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          DEBATE PANEL (CONFIRMED / REJECTED WITH EVIDENCE)
      ═══════════════════════════════════════════════════════════════════ */}
      {verdicts.length === 0 ? (
        <div className="p-12 text-center text-xs font-mono text-zinc-500 border border-dashed border-zinc-800 rounded-2xl bg-black/60">
          {isRunning
            ? 'Waiting for probe signals to reach Stage 4 triage debate...'
            : 'No triage results recorded yet. Launch a scan on Step 1.'}
        </div>
      ) : (
        <DebatePanel triageResults={verdicts} />
      )}

      {/* Footer Navigation */}
      <StepNavFooter currentStep={4} />
    </div>
  );
};

