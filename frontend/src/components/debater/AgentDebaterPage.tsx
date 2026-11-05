import React, { useState, useEffect, useMemo } from 'react';
import { useScanStore, scanStore } from '../../store/scanStore';
import { TriageResult } from '../../types';
import { getScanFindings } from '../../api/client';
import { FindingsList } from './FindingsList';
import { DebateThread } from './DebateThread';
import { VerdictCard } from './VerdictCard';
import { EvidenceAnalysisPanel } from './EvidenceAnalysisPanel';
import { ReportReadyBanner } from './ReportReadyBanner';
import {
  Scale,
  ArrowLeft,
  ArrowRight,
  ShieldAlert,
  Loader2,
  Sparkles,
} from 'lucide-react';

export const AgentDebaterPage: React.FC = () => {
  const verdicts = useScanStore((s) => s.verdicts);
  const rawFlags = useScanStore((s) => s.rawFlags);
  const scanId = useScanStore((s) => s.scanId);
  const steps = useScanStore((s) => s.steps);

  const isStepRunning = steps[4] === 'running';
  const isStepDone = steps[4] === 'done';

  // Next is enabled when triage is finished (or step 5 is unlocked / done, or findings are present)
  const isTriageFinished = isStepDone || steps[5] !== 'locked' || verdicts.length > 0;

  // Selected finding state
  const [selectedFindingId, setSelectedFindingId] = useState<string | null>(null);

  useEffect(() => {
    if (scanId && verdicts.length === 0) {
      getScanFindings(scanId).then((items) => {
        if (items && items.length > 0) {
          scanStore.dispatch({ type: 'SET_VERDICTS', payload: items });
          if (!selectedFindingId) {
            setSelectedFindingId(items[0].id);
          }
        }
      });
    }
  }, [scanId, verdicts.length, selectedFindingId]);

  useEffect(() => {
    if (verdicts.length > 0 && !selectedFindingId) {
      setSelectedFindingId(verdicts[0].id);
    }
  }, [verdicts, selectedFindingId]);

  const selectedFinding = useMemo(() => {
    return verdicts.find((v) => v.id === selectedFindingId) || verdicts[0] || null;
  }, [verdicts, selectedFindingId]);

  const currentIndex = useMemo(() => {
    if (!selectedFinding) return 0;
    return verdicts.findIndex((v) => v.id === selectedFinding.id);
  }, [verdicts, selectedFinding]);

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setSelectedFindingId(verdicts[currentIndex - 1].id);
    }
  };

  const handleNext = () => {
    if (currentIndex < verdicts.length - 1) {
      setSelectedFindingId(verdicts[currentIndex + 1].id);
    }
  };

  const handleNavigateToRoadmap = () => {
    scanStore.dispatch({ type: 'UNLOCK_STEP', payload: 5 });
    scanStore.dispatch({ type: 'GO_TO_STEP', payload: 5 });
  };

  const handleBackToStep3 = () => {
    scanStore.dispatch({ type: 'GO_TO_STEP', payload: 3 });
  };

  return (
    <div className="space-y-6 text-left">
      {/* ═══════════════════════════════════════════════════════════════════
          PAGE TOP BAR: STEP 4 OF 6 & BACK / NEXT CONTROLS
      ═══════════════════════════════════════════════════════════════════ */}
      <div className="p-4 rounded-2xl bg-[#090514]/90 border border-purple-500/30 flex flex-wrap items-center justify-between gap-4 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-purple-600/30 border border-purple-400/50 text-purple-200 text-sm font-mono font-bold flex items-center justify-center shadow-[0_0_12px_rgba(168,85,247,0.3)]">
            4
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-white tracking-wide">
                Agent Debater — SpiderWeb Triage
              </h2>
              <span className="text-xs font-mono text-purple-300 bg-purple-950 px-2 py-0.5 rounded-full border border-purple-500/30">
                Step 4 of 6
              </span>
              {isStepRunning && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-mono bg-purple-500/20 text-purple-300 border border-purple-400 animate-pulse">
                  <Loader2 className="w-3 h-3 animate-spin" /> Adversarial Triage Live
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">
              Two adversarial agents (Prosecutor vs Defender) debate evidence validity before The Judge and Rule Enforcer.
            </p>
          </div>
        </div>

        {/* Back / Next buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleBackToStep3}
            className="px-3.5 py-2 rounded-xl bg-black/60 hover:bg-zinc-800 border border-zinc-700 text-xs font-mono text-zinc-300 hover:text-white flex items-center gap-1.5 transition cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Probes (Step 3)</span>
          </button>

          <button
            type="button"
            onClick={handleNavigateToRoadmap}
            disabled={!isTriageFinished}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-500 hover:to-fuchsia-500 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-mono font-bold text-white flex items-center gap-1.5 transition cursor-pointer shadow-[0_0_16px_rgba(168,85,247,0.3)]"
            title={
              isTriageFinished
                ? 'Advance to Step 5 Fix Roadmap'
                : 'Triage in progress: Next will unlock when verdicts finish'
            }
          >
            <span>Next: Fix Roadmap (Step 5)</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          REPORT READY BANNER (WHEN TRIAGE COMPLETED)
      ═══════════════════════════════════════════════════════════════════ */}
      {isTriageFinished && verdicts.length > 0 && (
        <ReportReadyBanner
          findings={verdicts}
          rawFlagsCount={rawFlags.length}
          onAdvanceToStep5={handleNavigateToRoadmap}
        />
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          3-COLUMN BEST-IN-CLASS LAYOUT
      ═══════════════════════════════════════════════════════════════════ */}
      {verdicts.length === 0 ? (
        <div className="p-16 text-center text-xs font-mono text-zinc-500 border border-dashed border-zinc-800 rounded-2xl bg-black/60 space-y-3">
          <Scale className="w-8 h-8 text-purple-400 mx-auto animate-pulse" />
          <p className="text-sm font-semibold text-zinc-300">
            {isStepRunning
              ? 'Collecting probe flags for adversarial triage debate...'
              : 'No findings recorded yet. Start a scan on Step 1 to populate adversarial debate.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* LEFT COLUMN: Findings List (4 cols) */}
          <div className="lg:col-span-4 h-full">
            <FindingsList
              findings={verdicts}
              rawFlagsCount={rawFlags.length}
              selectedFindingId={selectedFinding?.id || null}
              onSelectFinding={(f) => setSelectedFindingId(f.id)}
            />
          </div>

          {/* CENTER COLUMN: Debate Thread + Pinned Verdict Card (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            {selectedFinding ? (
              <>
                <DebateThread finding={selectedFinding} />
                <VerdictCard
                  finding={selectedFinding}
                  currentIndex={currentIndex}
                  totalCount={verdicts.length}
                  onPrevious={handlePrevious}
                  onNext={handleNext}
                  onNavigateToRoadmap={handleNavigateToRoadmap}
                />
              </>
            ) : null}
          </div>

          {/* RIGHT COLUMN: Evidence & Analysis Panel (3 cols) */}
          <div className="lg:col-span-3 h-full">
            {selectedFinding ? <EvidenceAnalysisPanel finding={selectedFinding} /> : null}
          </div>
        </div>
      )}
    </div>
  );
};

