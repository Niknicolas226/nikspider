import React from 'react';
import { PIPELINE_STAGES } from '../styles/theme';
import { CheckCircle2, Loader2, CircleDot } from 'lucide-react';

interface ScanStepperProps {
  currentStage: number; // 0 to 6
  isScanning: boolean;
  isComplete: boolean;
  onSelectStage?: (stage: number) => void;
}

export const ScanStepper: React.FC<ScanStepperProps> = ({
  currentStage,
  isScanning,
  isComplete,
  onSelectStage,
}) => {
  return (
    <div className="rounded-2xl border border-cyan-500/20 bg-[#070c18]/90 p-4 backdrop-blur shadow-[0_12px_40px_rgba(2,8,23,0.6)]">
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono uppercase tracking-wider text-cyan-400 font-bold">
            Autonomous Pipeline Stepper (Stage 0 → 6)
          </span>
          {isScanning && !isComplete && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 animate-pulse">
              <Loader2 className="w-3 h-3 animate-spin" /> Stage {currentStage} Active
            </span>
          )}
          {isComplete && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/15 text-[#61f5ae] border border-emerald-500/30">
              <CheckCircle2 className="w-3 h-3" /> All 7 Stages Complete
            </span>
          )}
        </div>
        <span className="text-[11px] font-mono text-slate-400">
          {Math.min(100, Math.round(((isComplete ? 7 : currentStage + 1) / 7) * 100))}% pipeline progress
        </span>
      </div>

      {/* Stepper Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
        {PIPELINE_STAGES.map((item) => {
          const isDone = isComplete || item.stage < currentStage;
          const isActive = !isComplete && item.stage === currentStage;

          return (
            <button
              key={item.stage}
              type="button"
              onClick={() => onSelectStage?.(item.stage)}
              className={`group text-left p-2.5 rounded-xl border transition-all flex flex-col justify-between cursor-pointer ${
                isActive
                  ? 'bg-cyan-950/50 border-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.22)]'
                  : isDone
                  ? 'bg-emerald-950/20 border-emerald-500/35 hover:border-emerald-400/60'
                  : 'bg-slate-950/60 border-slate-800/80 opacity-65 hover:opacity-100'
              }`}
            >
              <div className="flex items-center justify-between gap-1 mb-1.5">
                <span
                  className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                    isActive
                      ? 'bg-cyan-500/25 text-cyan-200'
                      : isDone
                      ? 'bg-emerald-500/20 text-[#61f5ae]'
                      : 'bg-slate-900 text-slate-500'
                  }`}
                >
                  {item.code}
                </span>

                {isDone ? (
                  <CheckCircle2 className="w-4 h-4 text-[#61f5ae] shrink-0" />
                ) : isActive ? (
                  <Loader2 className="w-4 h-4 text-cyan-300 animate-spin shrink-0" />
                ) : (
                  <CircleDot className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                )}
              </div>

              <div>
                <div
                  className={`text-xs font-bold leading-snug ${
                    isActive ? 'text-white' : isDone ? 'text-emerald-200' : 'text-slate-400'
                  }`}
                >
                  {item.shortName}
                </div>
                <p className="text-[10px] text-slate-400/90 line-clamp-2 mt-0.5 leading-tight">
                  {item.description}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default ScanStepper;

