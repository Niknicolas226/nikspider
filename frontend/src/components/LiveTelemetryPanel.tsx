import React from 'react';
import { Activity } from 'lucide-react';
import { PROFILES } from '../styles/theme';

interface LiveTelemetryPanelProps {
  pagesCrawled: number;
  crawlQueue: number;
  endpointsMapped: number;
  checksDone: number;
  profileId: 'safe' | 'standard' | 'aggressive';
  requestsPerSecond: number;
  scanStatus: string;
}

export const LiveTelemetryPanel: React.FC<LiveTelemetryPanelProps> = ({
  pagesCrawled,
  crawlQueue,
  endpointsMapped,
  checksDone,
  profileId,
  requestsPerSecond,
  scanStatus,
}) => {
  const totalChecks = PROFILES[profileId]?.moduleCount || 32;
  const totalEstimatedPages = Math.max(pagesCrawled + crawlQueue, pagesCrawled, 1);
  const pagesPct =
    pagesCrawled === 0
      ? 0
      : scanStatus === 'completed'
      ? 100
      : Math.min(100, Math.round((pagesCrawled / totalEstimatedPages) * 100));

  const endpointsPct =
    endpointsMapped === 0
      ? 0
      : scanStatus === 'completed'
      ? 100
      : Math.min(100, Math.round((endpointsMapped / Math.max(endpointsMapped + crawlQueue, 1)) * 100));

  const checksPct =
    checksDone === 0
      ? 0
      : scanStatus === 'completed'
      ? 100
      : Math.min(100, Math.round((checksDone / totalChecks) * 100));

  const rpsPct = Math.min(100, Math.round((requestsPerSecond / 25) * 100));

  return (
    <div
      className="rounded-2xl border border-purple-500/35 bg-[#07030d]/90 backdrop-blur-xl p-4 flex flex-col justify-between"
      style={{
        boxShadow: '0 0 28px rgba(168, 85, 247, 0.14), inset 0 1px 0 rgba(192, 132, 252, 0.12)',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-purple-400" />
          <span className="text-sm font-semibold text-white tracking-tight">
            Live Telemetry
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] font-mono text-emerald-400">
          <span
            className={`w-2 h-2 rounded-full bg-emerald-400 ${
              scanStatus === 'running' ? 'animate-ping' : ''
            }`}
          />
          <span>Real-Time</span>
        </div>
      </div>

      {/* Telemetry Bars */}
      <div className="space-y-3 text-xs">
        {/* 1. Pages Crawled */}
        <div className="grid grid-cols-12 items-center gap-2">
          <span className="col-span-4 text-zinc-300 truncate">Pages Crawled</span>
          <div className="col-span-5 h-2 rounded-full bg-purple-950/60 border border-purple-500/20 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-purple-600 to-fuchsia-400 transition-all duration-300 shadow-[0_0_10px_#a855f7]"
              style={{ width: `${pagesPct}%` }}
            />
          </div>
          <div className="col-span-3 flex items-center justify-end gap-2 font-mono">
            <span className="text-[11px] text-zinc-400">{pagesPct}%</span>
            <span className="text-white font-semibold">{pagesCrawled}</span>
          </div>
        </div>

        {/* 2. Endpoints Mapped */}
        <div className="grid grid-cols-12 items-center gap-2">
          <span className="col-span-4 text-zinc-300 truncate">Endpoints Mapped</span>
          <div className="col-span-5 h-2 rounded-full bg-purple-950/60 border border-purple-500/20 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-purple-600 to-fuchsia-400 transition-all duration-300 shadow-[0_0_10px_#a855f7]"
              style={{ width: `${endpointsPct}%` }}
            />
          </div>
          <div className="col-span-3 flex items-center justify-end gap-2 font-mono">
            <span className="text-[11px] text-zinc-400">{endpointsPct}%</span>
            <span className="text-white font-semibold">{endpointsMapped}</span>
          </div>
        </div>

        {/* 3. Security Checks */}
        <div className="grid grid-cols-12 items-center gap-2">
          <span className="col-span-4 text-zinc-300 truncate">Security Checks</span>
          <div className="col-span-5 h-2 rounded-full bg-purple-950/60 border border-purple-500/20 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-purple-600 to-fuchsia-400 transition-all duration-300 shadow-[0_0_10px_#a855f7]"
              style={{ width: `${checksPct}%` }}
            />
          </div>
          <div className="col-span-3 flex items-center justify-end gap-1.5 font-mono">
            <span className="text-[11px] text-zinc-400">{checksPct}%</span>
            <span className="text-white font-semibold">
              {checksDone} / {totalChecks}
            </span>
          </div>
        </div>

        {/* 4. Requests / Second */}
        <div className="grid grid-cols-12 items-center gap-2">
          <span className="col-span-4 text-zinc-300 truncate">Requests / Second</span>
          <div className="col-span-5 h-2 rounded-full bg-purple-950/60 border border-purple-500/20 overflow-hidden flex items-center">
            <div
              className="h-full rounded-full bg-gradient-to-r from-purple-500 to-purple-300 transition-all duration-300"
              style={{ width: `${Math.max(rpsPct, requestsPerSecond > 0 ? 12 : 6)}%` }}
            />
          </div>
          <div className="col-span-3 flex items-center justify-end font-mono">
            <span className="text-white font-semibold">{requestsPerSecond}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

