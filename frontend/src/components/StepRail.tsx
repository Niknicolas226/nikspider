import React, { useRef } from 'react';
import { StepId, STEPS } from '../config/steps';
import { useScanStore, scanStore } from '../store/scanStore';
import { CheckCircle2, Loader2, Lock, ArrowRight, ArrowLeft } from 'lucide-react';

interface StepRailProps {
  onSelectStep?: (stepId: StepId) => void;
}

export const StepRail: React.FC<StepRailProps> = ({ onSelectStep }) => {
  const currentStep = useScanStore((s) => s.currentStep);
  const furthestStep = useScanStore((s) => s.furthestStep);
  const stepsState = useScanStore((s) => s.steps);
  const buttonsRef = useRef<(HTMLButtonElement | null)[]>([]);

  const handleStepClick = (stepId: StepId) => {
    const status = stepsState[stepId];
    if (status === 'locked' && stepId > furthestStep) {
      return;
    }
    if (onSelectStep) {
      onSelectStep(stepId);
    } else {
      scanStore.dispatch({ type: 'GO_TO_STEP', payload: stepId });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    let nextIndex = -1;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      nextIndex = (index + 1) % STEPS.length;
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      nextIndex = (index - 1 + STEPS.length) % STEPS.length;
    }

    if (nextIndex >= 0) {
      e.preventDefault();
      const targetStep = STEPS[nextIndex].id;
      const status = stepsState[targetStep];
      if (status !== 'locked' || targetStep <= furthestStep) {
        handleStepClick(targetStep);
      }
      buttonsRef.current[nextIndex]?.focus();
    }
  };

  const activeConfig = STEPS.find((s) => s.id === currentStep) || STEPS[0];

  return (
    <div className="w-full space-y-3" role="region" aria-label="Scan Workflow Navigation">
      {/* ═══════════════════════════════════════════════════════════════════
          YOU ARE HERE BANNER
      ═══════════════════════════════════════════════════════════════════ */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 rounded-xl bg-purple-950/30 border border-purple-500/25 text-xs font-mono shadow-[0_0_16px_rgba(168,85,247,0.15)]">
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded bg-purple-600/30 text-purple-200 border border-purple-400/40 font-bold uppercase tracking-wider text-[11px]">
            YOU ARE HERE: Step {currentStep} of 6
          </span>
          <span className="text-white font-semibold">{activeConfig.name}</span>
          <span className="text-purple-400/60 hidden sm:inline">•</span>
          <span className="text-purple-300/80 hidden sm:inline text-[11px]">
            {activeConfig.cluster}
          </span>
        </div>

        <div className="text-zinc-300 text-[11px] truncate max-w-md">
          <span className="text-purple-400 font-semibold mr-1">What you do now:</span>
          {activeConfig.whatYouDoNow}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          6-STEP RAIL BUTTONS
      ═══════════════════════════════════════════════════════════════════ */}
      <nav
        className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2"
        aria-label="Workflow Steps"
      >
        {STEPS.map((step, idx) => {
          const status = stepsState[step.id];
          const isCurrent = step.id === currentStep;
          const isLocked = status === 'locked' && step.id > furthestStep;
          const isDone = status === 'done';
          const isRunning = status === 'running';

          let stateStyle = 'bg-black/60 border-zinc-800 text-zinc-500 opacity-60 cursor-not-allowed';
          if (isCurrent) {
            stateStyle =
              'bg-purple-600/25 border-purple-400 text-white shadow-[0_0_20px_rgba(168,85,247,0.35)] ring-1 ring-purple-400 cursor-pointer';
          } else if (isDone) {
            stateStyle =
              'bg-emerald-950/25 border-emerald-500/40 text-emerald-200 hover:border-emerald-400 cursor-pointer';
          } else if (isRunning) {
            stateStyle =
              'bg-purple-950/40 border-purple-400 text-purple-200 animate-pulse cursor-pointer';
          } else if (!isLocked) {
            stateStyle =
              'bg-black/80 border-purple-500/25 text-zinc-300 hover:border-purple-500/50 cursor-pointer';
          }

          return (
            <button
              key={step.id}
              ref={(el) => {
                buttonsRef.current[idx] = el;
              }}
              type="button"
              disabled={isLocked}
              aria-disabled={isLocked}
              aria-current={isCurrent ? 'step' : undefined}
              title={isLocked ? `Complete step ${step.id - 1} first` : `View Step ${step.id}: ${step.name}`}
              onClick={() => handleStepClick(step.id)}
              onKeyDown={(e) => handleKeyDown(e, idx)}
              className={`p-2.5 rounded-xl border text-left transition-all duration-200 flex flex-col justify-between focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 ${stateStyle}`}
            >
              <div className="flex items-center justify-between gap-1 w-full font-mono text-xs">
                <div className="flex items-center gap-1.5">
                  <span
                    className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                      isDone
                        ? 'bg-emerald-500 text-black'
                        : isRunning
                        ? 'bg-purple-500 text-white'
                        : isCurrent
                        ? 'bg-purple-400 text-black'
                        : isLocked
                        ? 'bg-zinc-800 text-zinc-500'
                        : 'bg-zinc-700 text-zinc-300'
                    }`}
                  >
                    {step.id}
                  </span>
                  <span className="font-semibold truncate max-w-[80px] sm:max-w-[95px]">
                    {step.shortLabel}
                  </span>
                </div>

                <div className="shrink-0">
                  {isDone && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                  {isRunning && <Loader2 className="w-3.5 h-3.5 text-purple-300 animate-spin" />}
                  {isLocked && <Lock className="w-3 h-3 text-zinc-600" />}
                </div>
              </div>

              <div className="mt-1 text-[10px] font-sans text-zinc-400 truncate">
                {isDone ? 'Report Ready' : isRunning ? 'Executing...' : step.cluster}
              </div>
            </button>
          );
        })}
      </nav>
    </div>
  );
};
