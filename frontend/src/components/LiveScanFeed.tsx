import React, { useState } from 'react';
import { PlanItem, RawFlag, RequestLogEntry } from '../types';
import { Activity, Globe, Compass, Flag, ChevronDown, ChevronUp, Bot, Terminal } from 'lucide-react';

interface LiveScanFeedProps {
  pagesCrawled: number;
  queueLength: number;
  plan: PlanItem[];
  rawFlags: RawFlag[];
  requestLogs: RequestLogEntry[];
  isScanning: boolean;
}

export const LiveScanFeed: React.FC<LiveScanFeedProps> = ({
  pagesCrawled,
  queueLength,
  plan,
  rawFlags,
  requestLogs,
  isScanning,
}) => {
  const [showLogs, setShowLogs] = useState(false);

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 backdrop-blur space-y-5">
      {/* Real-time Status Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-cyan-500/10 border border-cyan-500/30 rounded-lg text-cyan-400">
            <Activity className={`w-5 h-5 ${isScanning ? 'animate-pulse text-cyan-300' : ''}`} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              Live Scan Execution Feed
              {isScanning && (
                <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/60 border border-cyan-500/30 px-2 py-0.5 rounded-full animate-pulse">
                  SCAN IN PROGRESS
                </span>
              )}
            </h3>
            <p className="text-xs text-slate-400">Continuous SSE event stream with non-destructive probes</p>
          </div>
        </div>

        {/* Telemetry Stats */}
        <div className="flex items-center gap-4 text-xs font-mono">
          <div className="bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800 flex items-center gap-2">
            <Globe className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-slate-400">Pages Crawled:</span>
            <span className="text-white font-bold">{pagesCrawled}</span>
            {queueLength > 0 && <span className="text-slate-500">({queueLength} in queue)</span>}
          </div>

          <div className="bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800 flex items-center gap-2">
            <Flag className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-slate-400">Raw Flags:</span>
            <span className="text-amber-300 font-bold">{rawFlags.length}</span>
          </div>
        </div>
      </div>

      {/* Meta Model Test Planner Table */}
      {plan.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
              <Compass className="w-3.5 h-3.5" />
              Targeted Test Plan
            </span>
            <span className="inline-flex items-center gap-1 text-[11px] font-mono bg-purple-500/10 text-purple-300 border border-purple-500/30 px-2 py-0.5 rounded">
              <Bot className="w-3 h-3" /> Meta model: planner
            </span>
          </div>

          <div className="overflow-x-auto rounded-lg border border-slate-800">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                <tr>
                  <th className="py-2.5 px-3">Target URL</th>
                  <th className="py-2.5 px-3">Planned Probes</th>
                  <th className="py-2.5 px-3">Model Rationale</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 bg-slate-900/40">
                {plan.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-800/30 transition">
                    <td className="py-2 px-3 font-mono text-cyan-300 max-w-[260px] truncate">{item.url}</td>
                    <td className="py-2 px-3">
                      <div className="flex gap-1">
                        {item.checks.map((chk) => (
                          <span
                            key={chk}
                            className="uppercase text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 font-mono"
                          >
                            {chk}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-2 px-3 text-slate-400 max-w-[320px] truncate">{item.why}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Collapsible Request Log */}
      <div className="border border-slate-800 rounded-lg overflow-hidden">
        <button
          type="button"
          onClick={() => setShowLogs(!showLogs)}
          className="w-full py-2 px-4 bg-slate-950 hover:bg-slate-900 text-left flex items-center justify-between text-xs text-slate-300 transition cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <Terminal className="w-3.5 h-3.5 text-cyan-400" />
            <span className="font-semibold">Live HTTP Request Log</span>
            <span className="text-[10px] font-mono text-slate-500">({requestLogs.length} events logged)</span>
          </div>
          {showLogs ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </button>

        {showLogs && (
          <div className="p-3 bg-slate-950 max-h-52 overflow-y-auto font-mono text-[11px] space-y-1 divide-y divide-slate-900">
            {requestLogs.length === 0 ? (
              <div className="text-slate-500 italic py-2">No outgoing requests logged yet.</div>
            ) : (
              requestLogs.map((req) => (
                <div key={req.id} className="pt-1 flex items-center justify-between text-slate-400">
                  <div className="flex items-center gap-2 truncate max-w-[85%]">
                    <span
                      className={`font-bold px-1 rounded text-[10px] ${
                        req.method === 'POST' ? 'text-amber-400 bg-amber-950/40' : 'text-cyan-400 bg-cyan-950/40'
                      }`}
                    >
                      {req.method}
                    </span>
                    <span className="text-slate-300 truncate">{req.url}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`font-bold text-[10px] ${
                        req.status && req.status >= 500
                          ? 'text-red-400'
                          : req.status && req.status >= 400
                          ? 'text-amber-400'
                          : 'text-emerald-400'
                      }`}
                    >
                      {req.status ?? 'ERR'}
                    </span>
                    <span className="text-[10px] text-slate-600">
                      {new Date(req.ts).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};

