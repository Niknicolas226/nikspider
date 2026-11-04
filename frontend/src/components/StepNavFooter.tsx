import React from 'react';
import { StepId, STEPS } from '../config/steps';
import { useScanStore, scanStore } from '../store/scanStore';
import { ArrowLeft, ArrowRight, CheckCircle2 } from 'lucide-react';

interface StepNavFooterProps {
  currentStep: StepId;
  onNext?: () => void;
  onBack?: () => void;
}

export const StepNavFooter: React.FC<StepNavFooterProps> = ({ currentStep, onNext, onBack }) => {
  const furthestStep = useScanStore((s) => s.furthestStep);
  const stepsState = useScanStore((s) => s.steps);

  const prevStepId = (currentStep > 1 ? currentStep - 1 : null) as StepId | null;
  const nextStepId = (currentStep < 6 ? currentStep + 1 : null) as StepId | null;

  const canGoNext =
    nextStepId !== null && (nextStepId <= furthestStep || stepsState[nextStepId] !== 'locked');

  const handleBack = () => {
    if (!prevStepId) return;
    if (onBack) {
      onBack();
    } else {
      scanStore.dispatch({ type: 'GO_TO_STEP', payload: prevStepId });
    }
  };

  const handleNext = () => {
    if (!nextStepId || !canGoNext) return;
    if (onNext) {
      onNext();
    } else {
      scanStore.dispatch({ type: 'GO_TO_STEP', payload: nextStepId });
    }
  };

  const prevConfig = prevStepId ? STEPS[prevStepId - 1] : null;
  const nextConfig = nextStepId ? STEPS[nextStepId - 1] : null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 pt-6 border-t border-purple-500/20 text-xs font-mono">
      <div>
        {prevStepId ? (
          <button
            type="button"
            onClick={handleBack}
            className="px-4 py-2 rounded-xl bg-black/60 hover:bg-purple-950/40 border border-purple-500/30 hover:border-purple-500/60 text-zinc-300 hover:text-white flex items-center gap-2 transition cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>
              Back: Step {prevStepId} ({prevConfig?.shortLabel})
            </span>
          </button>
        ) : (
          <div />
        )}
      </div>

      <div className="flex items-center gap-3">
        <span className="text-zinc-500 hidden sm:inline">
          Step {currentStep} of 6
        </span>

        {nextStepId && (
          <button
            type="button"
            disabled={!canGoNext}
            onClick={handleNext}
            title={canGoNext ? `Advance to Step ${nextStepId}` : `Complete Step ${currentStep} first to unlock`}
            className={`px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 transition ${
              canGoNext
                ? 'bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-500 hover:to-fuchsia-500 text-white shadow-[0_0_18px_rgba(168,85,247,0.4)] cursor-pointer'
                : 'bg-black/50 border border-zinc-800 text-zinc-600 cursor-not-allowed opacity-60'
            }`}
          >
            <span>
              Next: Step {nextStepId} ({nextConfig?.shortLabel})
            </span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
};

