import React from 'react';
import { Check, Loader2, Shield } from 'lucide-react';

export type FlowStep = 1 | 2 | 3 | 4;

interface StepIndicatorProps {
  currentStep: FlowStep;
  targetUrl?: string;
  onReset?: () => void;
}

const STEPS: { id: FlowStep; label: string }[] = [
  { id: 1, label: 'Verify' },
  { id: 2, label: 'Configure' },
  { id: 3, label: 'Scan' },
  { id: 4, label: 'Results' },
];

export const StepIndicator: React.FC<StepIndicatorProps> = ({
  currentStep,
  targetUrl,
  onReset,
}) => {
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[#000000]/95 backdrop-blur-md px-6 py-3.5">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-[#0a0a0a] border border-[#00d9ff]/40 text-[#00d9ff] shadow-[0_0_18px_rgba(0,217,255,0.28)]">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-extrabold tracking-tight text-white">NikSpider</span>
              <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-[#00d9ff]/10 text-[#00d9ff] border border-[#00d9ff]/30">
                AI AppSec Platform
              </span>
            </div>
            {targetUrl && (
              <div className="text-[11px] font-mono text-zinc-400 flex items-center gap-1.5 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#00d9ff] shadow-[0_0_8px_#00d9ff]" />
                <span>Scope: {targetUrl}</span>
              </div>
            )}
          </div>
        </div>

        {/* 1 Verify ✓ → 2 Configure → 3 Scan → 4 Results */}
        <nav aria-label="Scan lifecycle steps" className="flex items-center gap-2 font-mono text-xs">
          {STEPS.map((step, idx) => {
            const isCompleted = step.id < currentStep || (step.id === 1 && currentStep >= 2);
            const isCurrent = step.id === currentStep;

            return (
              <React.Fragment key={step.id}>
                <div
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all ${
                    isCurrent
                      ? 'bg-[#00d9ff]/15 border-[#00d9ff] text-white shadow-[0_0_18px_rgba(0,217,255,0.3)]'
                      : isCompleted
                      ? 'bg-[#a855f7]/15 border-[#a855f7]/50 text-[#a855f7]'
                      : 'bg-[#0a0a0a] border-white/10 text-zinc-500'
                  }`}
                >
                  <span
                    className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold ${
                      isCurrent
                        ? 'bg-[#00d9ff] text-black'
                        : isCompleted
                        ? 'bg-[#a855f7] text-white'
                        : 'bg-zinc-900 text-zinc-500'
                    }`}
                  >
                    {isCompleted ? (
                      <Check className="w-3 h-3 stroke-[3]" />
                    ) : isCurrent && step.id === 3 ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      step.id
                    )}
                  </span>
                  <span className="font-bold">{step.label}</span>
                  {isCompleted && <span className="text-[#00d9ff] font-bold">✓</span>}
                </div>

                {idx < STEPS.length - 1 && (
                  <span
                    className={`select-none ${
                      step.id < currentStep ? 'text-[#a855f7]' : 'text-zinc-700'
                    }`}
                  >
                    →
                  </span>
                )}
              </React.Fragment>
            );
          })}
        </nav>

        {/* Reset / New Target */}
        {onReset && (
          <button
            type="button"
            onClick={onReset}
            className="px-3 py-1.5 rounded-lg bg-[#0a0a0a] hover:bg-white/5 text-zinc-300 hover:text-white border border-white/15 text-xs font-mono transition cursor-pointer"
          >
            Change Target
          </button>
        )}
      </div>
    </header>
  );
};

export default StepIndicator;

