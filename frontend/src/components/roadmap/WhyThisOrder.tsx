import React, { useState } from 'react';
import { HelpCircle, ChevronRight, Zap, GitBranch, ShieldAlert } from 'lucide-react';

export const WhyThisOrder: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative inline-block text-left">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-950/40 hover:bg-purple-950/70 border border-purple-500/30 text-purple-300 hover:text-purple-200 text-xs font-mono transition cursor-pointer"
      >
        <HelpCircle className="w-3.5 h-3.5 text-purple-400" />
        <span>Why this order?</span>
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-[#0e071c] border border-purple-500/40 shadow-[0_0_30px_rgba(168,85,247,0.35)] p-4 z-50 text-left space-y-3 backdrop-blur-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-purple-500/20 pb-2">
              <span className="text-xs font-bold text-white font-mono flex items-center gap-2">
                <GitBranch className="w-4 h-4 text-purple-400" />
                Deterministic DAG Remediation Algorithm
              </span>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-zinc-500 hover:text-white text-xs"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-zinc-300 leading-relaxed">
              NikSpider orders repair items to achieve the fastest possible drop in attack surface:
            </p>

            <div className="space-y-2 text-xs font-mono">
              <div className="p-2.5 rounded-xl bg-purple-950/30 border border-purple-500/30 space-y-1">
                <div className="text-purple-300 font-bold flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                  1. Severity Weight (Critical=25, High=15, Med=8, Low=3)
                </div>
                <p className="text-[11px] text-zinc-400">
                  Critical and High issues pose acute exploitation risk and are prioritized first.
                </p>
              </div>

              <div className="p-2.5 rounded-xl bg-purple-950/30 border border-purple-500/30 space-y-1">
                <div className="text-cyan-300 font-bold flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                  2. Multiplying by Affected Endpoints
                </div>
                <p className="text-[11px] text-zinc-400">
                  A root cause fixing 5 endpoints simultaneously yields 5x the impact score.
                </p>
              </div>

              <div className="p-2.5 rounded-xl bg-purple-950/30 border border-purple-500/30 space-y-1">
                <div className="text-emerald-300 font-bold flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  3. Dependency Unblocking
                </div>
                <p className="text-[11px] text-zinc-400">
                  Resolving foundation security controls (e.g. session encryption or CORS headers) protects and unblocks downstream API endpoints.
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

