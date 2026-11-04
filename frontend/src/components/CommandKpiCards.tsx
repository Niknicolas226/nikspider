import React from 'react';
import { useScanStore } from '../store/scanStore';
import { ShieldAlert, CheckCircle2, Flame, Layers, Clock, ArrowDownRight } from 'lucide-react';

export const CommandKpiCards: React.FC = () => {
  const kpis = useScanStore((s) => s.kpis);
  const scanStatus = useScanStore((s) => s.scanStatus);
  const scanStartedAt = useScanStore((s) => s.scanStartedAt);
  const scanCompletedAt = useScanStore((s) => s.scanCompletedAt);

  // Format duration into MM:SS
  const formatDuration = (seconds: number | null): string => {
    if (seconds === null && !scanStartedAt) return '--:--';
    const s = seconds ?? 0;
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const riskScoreDisplay =
    kpis.riskScore !== null && kpis.riskScore !== undefined ? `${kpis.riskScore}` : '--';

  const riskScoreColor =
    kpis.riskScore === null
      ? 'text-zinc-500 border-zinc-800'
      : kpis.riskScore > 70
      ? 'text-red-400 border-red-500/40 shadow-[0_0_20px_rgba(239,68,68,0.2)]'
      : kpis.riskScore > 30
      ? 'text-amber-400 border-amber-500/40 shadow-[0_0_20px_rgba(245,158,11,0.2)]'
      : 'text-emerald-400 border-emerald-500/40 shadow-[0_0_20px_rgba(16,185,129,0.2)]';

  const confirmedDisplay =
    scanStatus === 'idle' && kpis.confirmed === 0 ? '--' : `${kpis.confirmed}`;

  const highSevDisplay =
    scanStatus === 'idle' && kpis.highSeverity === 0 ? '--' : `${kpis.highSeverity}`;

  const endpointsDisplay =
    scanStatus === 'idle' && kpis.endpoints === 0 ? '--' : `${kpis.endpoints}`;

  const durationDisplay = formatDuration(kpis.durationSec);

  return (
    <div
      className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3"
      role="region"
      aria-label="Key Performance Indicators"
    >
      {/* 1. RISK SCORE */}
      <div className={`p-4 rounded-2xl bg-black/75 border transition-all ${riskScoreColor}`}>
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 font-semibold">
            Risk Score
          </span>
          <Flame className="w-4 h-4 text-purple-400 opacity-75" />
        </div>
        <div className="mt-2 flex items-baseline gap-1">
          <span className="text-3xl font-extrabold font-mono tracking-tight text-white">
            {riskScoreDisplay}
          </span>
          <span className="text-xs text-zinc-500 font-mono">/100</span>
        </div>
        <div className="mt-1.5 text-[10px] text-zinc-400 leading-tight">
          Weighted target posture score
        </div>
      </div>

      {/* 2. CONFIRMED FINDINGS */}
      <div className="p-4 rounded-2xl bg-black/75 border border-purple-500/30 hover:border-purple-500/50 transition-all">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 font-semibold">
            Confirmed Findings
          </span>
          <CheckCircle2 className="w-4 h-4 text-emerald-400 opacity-80" />
        </div>
        <div className="mt-2 text-3xl font-extrabold font-mono tracking-tight text-emerald-300">
          {confirmedDisplay}
        </div>
        <div className="mt-1.5 text-[10px] text-zinc-400 leading-tight">
          Vulnerabilities verified by multi-agent debate
        </div>
      </div>

      {/* 3. HIGH SEVERITY */}
      <div className="p-4 rounded-2xl bg-black/75 border border-purple-500/30 hover:border-purple-500/50 transition-all">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 font-semibold">
            High Severity
          </span>
          <ShieldAlert className="w-4 h-4 text-rose-400 opacity-80" />
        </div>
        <div className="mt-2 text-3xl font-extrabold font-mono tracking-tight text-rose-300">
          {highSevDisplay}
        </div>
        <div className="mt-1.5 text-[10px] text-zinc-400 leading-tight">
          Critical and High priority issues requiring remediation
        </div>
      </div>

      {/* 4. ENDPOINTS */}
      <div className="p-4 rounded-2xl bg-black/75 border border-purple-500/30 hover:border-purple-500/50 transition-all">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 font-semibold">
            Endpoints
          </span>
          <Layers className="w-4 h-4 text-purple-400 opacity-80" />
        </div>
        <div className="mt-2 text-3xl font-extrabold font-mono tracking-tight text-purple-200">
          {endpointsDisplay}
        </div>
        <div className="mt-1.5 text-[10px] text-zinc-400 leading-tight">
          Mapped pages and API routes in scope
        </div>
      </div>

      {/* 5. SCAN DURATION */}
      <div className="p-4 rounded-2xl bg-black/75 border border-purple-500/30 hover:border-purple-500/50 transition-all col-span-2 sm:col-span-1">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 font-semibold">
            Scan Duration
          </span>
          <Clock className="w-4 h-4 text-cyan-400 opacity-80" />
        </div>
        <div className="mt-2 text-3xl font-extrabold font-mono tracking-tight text-cyan-300">
          {durationDisplay}
        </div>
        <div className="mt-1.5 text-[10px] text-zinc-400 leading-tight">
          Total assessment elapsed time
        </div>
      </div>
    </div>
  );
};

