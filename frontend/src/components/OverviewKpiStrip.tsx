import React, { useEffect, useState } from 'react';
import { ShieldAlert, CheckCircle2, Flame, Layers, Clock } from 'lucide-react';
import { ScanHistoryPoint } from '../api/client';
import { getRiskBand } from '../styles/theme';

interface OverviewKpiStripProps {
  riskScore: number;
  confirmedCount: number;
  highSeverityCount: number;
  endpointsCount: number;
  scanStatus: 'idle' | 'queued' | 'running' | 'completed' | 'failed';
  scanStartedAt?: string | null;
  scanCompletedAt?: string | null;
  history: ScanHistoryPoint[];
}

function Sparkline({
  values,
  strokeColor,
  fillColor,
}: {
  values: number[];
  strokeColor: string;
  fillColor: string;
}) {
  const width = 92;
  const height = 36;

  // If no scan history exists yet, render an honest flat baseline
  if (!values || values.length === 0) {
    return (
      <svg width={width} height={height} className="overflow-visible opacity-50">
        <line
          x1={0}
          y1={height - 4}
          x2={width}
          y2={height - 4}
          stroke={strokeColor}
          strokeWidth={1.5}
          strokeDasharray="3 3"
        />
      </svg>
    );
  }

  const pts = values.length === 1 ? [values[0], values[0]] : values;
  const maxVal = Math.max(...pts, 1);
  const minVal = Math.min(...pts, 0);
  const range = Math.max(maxVal - minVal, 1);

  const coords = pts.map((v, i) => {
    const x = (i / (pts.length - 1)) * (width - 4) + 2;
    const y = height - 4 - ((v - minVal) / range) * (height - 10);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const polylinePoints = coords.join(' ');
  const areaPoints = `2,${height - 2} ${polylinePoints} ${width - 2},${height - 2}`;

  return (
    <svg width={width} height={height} className="overflow-visible">
      <polygon points={areaPoints} fill={fillColor} opacity={0.22} />
      <polyline
        fill="none"
        stroke={strokeColor}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        points={polylinePoints}
      />
    </svg>
  );
}

export const OverviewKpiStrip: React.FC<OverviewKpiStripProps> = ({
  riskScore,
  confirmedCount,
  highSeverityCount,
  endpointsCount,
  scanStatus,
  scanStartedAt,
  scanCompletedAt,
  history,
}) => {
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);

  useEffect(() => {
    if (!scanStartedAt) {
      setElapsedSeconds(0);
      return;
    }

    const startMs = new Date(scanStartedAt).getTime();
    if (Number.isNaN(startMs)) {
      setElapsedSeconds(0);
      return;
    }

    if (scanStatus === 'completed' || scanStatus === 'failed') {
      const endMs = scanCompletedAt ? new Date(scanCompletedAt).getTime() : Date.now();
      setElapsedSeconds(Math.max(0, Math.floor((endMs - startMs) / 1000)));
      return;
    }

    if (scanStatus === 'running' || scanStatus === 'queued') {
      const updateTimer = () => {
        setElapsedSeconds(Math.max(0, Math.floor((Date.now() - startMs) / 1000)));
      };
      updateTimer();
      const interval = setInterval(updateTimer, 1000);
      return () => clearInterval(interval);
    }
  }, [scanStatus, scanStartedAt, scanCompletedAt]);

  const formatDuration = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remSecs = secs % 60;
    return `${String(mins).padStart(2, '0')}:${String(remSecs).padStart(2, '0')}`;
  };

  const riskBand = getRiskBand(riskScore);

  const riskHistory = history.map((h) => h.risk_score);
  const confirmedHistory = history.map((h) => h.confirmed_count);
  const highHistory = history.map((h) => h.high_severity_count ?? h.confirmed_count);
  const endpointsHistory = history.map((h) => h.endpoints_count ?? h.raw_count);
  const durationHistory = history.map((h) => h.duration_seconds ?? 0);

  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
      {/* 1. Risk Score */}
      <div
        className="relative rounded-xl border border-red-500/30 bg-[#07030d]/90 backdrop-blur-xl px-4 py-3 flex items-center justify-between overflow-hidden"
        style={{ boxShadow: '0 0 24px rgba(239, 68, 68, 0.12)' }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-full bg-red-500/15 border border-red-500/40 flex items-center justify-center shrink-0">
            <ShieldAlert className="w-5 h-5 text-red-400" />
          </div>
          <div>
            <div className="text-[11px] text-zinc-400 font-medium">Risk Score</div>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span
                className="text-2xl font-bold font-mono tracking-tight transition-all duration-300"
                style={{ color: riskScore > 0 ? riskBand.color : '#f87171' }}
              >
                {riskScore}
              </span>
              <span className="text-xs font-mono text-red-400/70">/100</span>
            </div>
          </div>
        </div>
        <Sparkline values={riskHistory} strokeColor="#f87171" fillColor="#ef4444" />
      </div>

      {/* 2. Confirmed Findings */}
      <div
        className="relative rounded-xl border border-blue-500/30 bg-[#07030d]/90 backdrop-blur-xl px-4 py-3 flex items-center justify-between overflow-hidden"
        style={{ boxShadow: '0 0 24px rgba(59, 130, 246, 0.12)' }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-full bg-blue-500/15 border border-blue-500/40 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <div className="text-[11px] text-zinc-400 font-medium">Confirmed Findings</div>
            <div className="text-2xl font-bold font-mono text-blue-400 mt-0.5 transition-all duration-300">
              {confirmedCount}
            </div>
          </div>
        </div>
        <Sparkline values={confirmedHistory} strokeColor="#60a5fa" fillColor="#3b82f6" />
      </div>

      {/* 3. High Severity */}
      <div
        className="relative rounded-xl border border-amber-500/30 bg-[#07030d]/90 backdrop-blur-xl px-4 py-3 flex items-center justify-between overflow-hidden"
        style={{ boxShadow: '0 0 24px rgba(245, 158, 11, 0.12)' }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-full bg-amber-500/15 border border-amber-500/40 flex items-center justify-center shrink-0">
            <Flame className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <div className="text-[11px] text-zinc-400 font-medium">High Severity</div>
            <div className="text-2xl font-bold font-mono text-amber-400 mt-0.5 transition-all duration-300">
              {highSeverityCount}
            </div>
          </div>
        </div>
        <Sparkline values={highHistory} strokeColor="#fbbf24" fillColor="#f59e0b" />
      </div>

      {/* 4. Endpoints */}
      <div
        className="relative rounded-xl border border-purple-500/35 bg-[#07030d]/90 backdrop-blur-xl px-4 py-3 flex items-center justify-between overflow-hidden"
        style={{ boxShadow: '0 0 24px rgba(168, 85, 247, 0.15)' }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-full bg-purple-500/15 border border-purple-500/40 flex items-center justify-center shrink-0">
            <Layers className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <div className="text-[11px] text-zinc-400 font-medium">Endpoints</div>
            <div className="text-2xl font-bold font-mono text-purple-400 mt-0.5 transition-all duration-300">
              {endpointsCount}
            </div>
          </div>
        </div>
        <Sparkline values={endpointsHistory} strokeColor="#c084fc" fillColor="#a855f7" />
      </div>

      {/* 5. Scan Duration */}
      <div
        className="relative rounded-xl border border-purple-500/30 bg-[#07030d]/90 backdrop-blur-xl px-4 py-3 flex items-center justify-between overflow-hidden col-span-2 lg:col-span-1"
        style={{ boxShadow: '0 0 24px rgba(168, 85, 247, 0.12)' }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-full bg-purple-500/15 border border-purple-500/40 flex items-center justify-center shrink-0">
            <Clock
              className={`w-5 h-5 text-purple-300 ${
                scanStatus === 'running' ? 'animate-spin' : ''
              }`}
              style={{ animationDuration: '6s' }}
            />
          </div>
          <div>
            <div className="text-[11px] text-zinc-400 font-medium">Scan Duration</div>
            <div className="text-2xl font-bold font-mono text-white mt-0.5 tracking-wider">
              {formatDuration(elapsedSeconds)}
            </div>
          </div>
        </div>
        <Sparkline values={durationHistory} strokeColor="#a855f7" fillColor="#9333ea" />
      </div>
    </div>
  );
};
