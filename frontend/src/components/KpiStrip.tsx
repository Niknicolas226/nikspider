import React, { useEffect, useState } from 'react';
import { TriageResult } from '../types';

interface KpiStripProps {
  riskScore: number;
  rawFlagsCount: number;
  confirmedCount: number;
  rejectedCount: number;
  triageResults: TriageResult[];
  isScanning: boolean;
}

const AnimatedNumber: React.FC<{ value: number; className?: string }> = ({ value, className = '' }) => {
  const [bump, setBump] = useState(false);

  useEffect(() => {
    setBump(true);
    const t = setTimeout(() => setBump(false), 380);
    return () => clearTimeout(t);
  }, [value]);

  return (
    <span
      className={`inline-block font-mono transition-transform duration-300 ${
        bump ? 'scale-125 text-[#00d9ff] drop-shadow-[0_0_16px_rgba(0,217,255,0.9)]' : ''
      } ${className}`}
    >
      {value}
    </span>
  );
};

export const KpiStrip: React.FC<KpiStripProps> = ({
  riskScore,
  rawFlagsCount,
  confirmedCount,
  rejectedCount,
  triageResults,
  isScanning,
}) => {
  const confirmedItems = triageResults.filter((r) => r.verdict === 'confirmed');
  const critCount = confirmedItems.filter((r) => r.severity === 'Critical').length;
  const highCount = confirmedItems.filter((r) => r.severity === 'High').length;
  const medCount = confirmedItems.filter((r) => r.severity === 'Medium').length;
  const lowCount = confirmedItems.filter((r) => r.severity === 'Low').length;

  const scoreBandColor =
    riskScore >= 70
      ? 'text-red-400 border-red-500/40 shadow-[0_0_24px_rgba(239,68,68,0.25)]'
      : riskScore >= 40
      ? 'text-amber-300 border-amber-500/40 shadow-[0_0_24px_rgba(245,158,11,0.22)]'
      : riskScore > 0
      ? 'text-[#00d9ff] border-[#00d9ff]/40 shadow-[0_0_24px_rgba(0,217,255,0.22)]'
      : 'text-emerald-400 border-emerald-500/40';

  return (
    <div className="sticky top-[61px] z-30 bg-[#000000]/95 backdrop-blur-md border-b border-white/10 py-3.5 px-6">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
        {/* Left: Risk Score (large, color-coded by band) */}
        <div className="flex items-center gap-4">
          <div className={`px-4 py-2 rounded-xl bg-[#0a0a0a] border ${scoreBandColor} flex items-baseline gap-2`}>
            <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400">
              Risk Score
            </span>
            <AnimatedNumber value={riskScore} className="text-2xl font-extrabold" />
            <span className="text-xs font-mono text-zinc-500">/100</span>
          </div>

          {isScanning && (
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#00d9ff]/10 border border-[#00d9ff]/30 text-[#00d9ff] text-xs font-mono">
              <span className="w-2 h-2 rounded-full bg-[#00d9ff] animate-ping" />
              <span>LIVE SSE STREAM</span>
            </div>
          )}
        </div>

        {/* Center: Raw Flags, Confirmed, Rejected */}
        <div className="flex flex-wrap items-center gap-3 font-mono">
          <div className="px-3.5 py-2 rounded-xl bg-[#0a0a0a] border border-white/10 flex items-center gap-2.5">
            <span className="text-[11px] text-zinc-400 uppercase">Raw Flags</span>
            <AnimatedNumber value={rawFlagsCount} className="text-lg font-extrabold text-white" />
          </div>

          <div className="px-3.5 py-2 rounded-xl bg-[#0a0a0a] border border-[#00d9ff]/35 flex items-center gap-2.5">
            <span className="text-[11px] text-[#00d9ff] uppercase">Confirmed</span>
            <AnimatedNumber value={confirmedCount} className="text-lg font-extrabold text-[#00d9ff]" />
          </div>

          <div className="px-3.5 py-2 rounded-xl bg-[#0a0a0a] border border-[#a855f7]/35 flex items-center gap-2.5">
            <span className="text-[11px] text-[#a855f7] uppercase">Rejected</span>
            <AnimatedNumber value={rejectedCount} className="text-lg font-extrabold text-[#a855f7]" />
          </div>
        </div>

        {/* Right: Severity Pill Counts */}
        <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
          <span className="px-2.5 py-1 rounded-full bg-red-500/15 border border-red-500/40 text-red-300">
            CRIT: <AnimatedNumber value={critCount} className="font-bold" />
          </span>
          <span className="px-2.5 py-1 rounded-full bg-orange-500/15 border border-orange-500/40 text-orange-300">
            HIGH: <AnimatedNumber value={highCount} className="font-bold" />
          </span>
          <span className="px-2.5 py-1 rounded-full bg-amber-500/15 border border-amber-500/40 text-amber-300">
            MED: <AnimatedNumber value={medCount} className="font-bold" />
          </span>
          <span className="px-2.5 py-1 rounded-full bg-[#00d9ff]/15 border border-[#00d9ff]/40 text-[#00d9ff]">
            LOW: <AnimatedNumber value={lowCount} className="font-bold" />
          </span>
        </div>
      </div>
    </div>
  );
};

export default KpiStrip;

