import React, { useEffect, useRef, useState } from 'react';
import { PlanItem, RequestLogEntry, SSEEvent } from '../types';
import { Terminal, ChevronDown, ChevronRight, Activity, ExternalLink } from 'lucide-react';

interface TabLiveScanProps {
  events: SSEEvent[];
  requestLogs: RequestLogEntry[];
  isScanning: boolean;
  onSelectTriageFinding: (findingId: string) => void;
}

const ExpandablePlanTable: React.FC<{ plan: PlanItem[] }> = ({ plan }) => {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="my-2 rounded-xl bg-[#000000] border border-[#a855f7]/40 overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="w-full px-3.5 py-2 bg-[#a855f7]/10 hover:bg-[#a855f7]/15 flex items-center justify-between text-xs font-mono text-[#a855f7] transition cursor-pointer"
      >
        <span className="flex items-center gap-2 font-bold">
          {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          <span>✓ Planner Ready — {plan.length} target route(s) scheduled (URL | Checks | Why)</span>
        </span>
        <span className="text-[10px] uppercase">{expanded ? 'Collapse' : 'Expand'}</span>
      </button>

      {expanded && (
        <div className="overflow-x-auto border-t border-[#a855f7]/25">
          <table className="w-full text-left font-mono text-xs border-collapse">
            <thead>
              <tr className="bg-[#0a0a0a] text-[10px] uppercase text-zinc-400 border-b border-white/10">
                <th className="py-2 px-3">URL</th>
                <th className="py-2 px-3">Checks</th>
                <th className="py-2 px-3">Why</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {plan.map((item, idx) => (
                <tr key={`${item.url}-${idx}`} className="hover:bg-white/[0.02]">
                  <td className="py-2 px-3 text-[#00d9ff] break-all">{item.url}</td>
                  <td className="py-2 px-3">
                    <div className="flex flex-wrap gap-1">
                      {item.checks.map((c) => (
                        <span
                          key={c}
                          className="px-1.5 py-0.5 rounded text-[10px] uppercase bg-[#a855f7]/15 text-[#a855f7] border border-[#a855f7]/35"
                        >
                          {c}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="py-2 px-3 text-zinc-300">{item.why}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export const TabLiveScan: React.FC<TabLiveScanProps> = ({
  events,
  requestLogs,
  isScanning,
  onSelectTriageFinding,
}) => {
  const [logDrawerOpen, setLogDrawerOpen] = useState(true);
  const terminalEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [events.length]);

  return (
    <div className="space-y-4">
      {/* Terminal Panel (Neon Blue #00d9ff accent) */}
      <div className="rounded-2xl bg-[#000000] border border-[#00d9ff]/40 shadow-[0_0_32px_rgba(0,217,255,0.12)] overflow-hidden">
        {/* Terminal Chrome Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-[#0a0a0a] border-b border-[#00d9ff]/25">
          <div className="flex items-center gap-3 font-mono text-xs">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#00d9ff] shadow-[0_0_8px_#00d9ff]" />
              <span className="w-2.5 h-2.5 rounded-full bg-[#a855f7]" />
            </div>
            <Terminal className="w-4 h-4 text-[#00d9ff]" />
            <span className="text-white font-bold">nikspider://sse-event-stream</span>
          </div>

          <div className="flex items-center gap-2 font-mono text-[11px]">
            <span className="text-zinc-400">{events.length} SSE events</span>
            <span
              className={`px-2 py-0.5 rounded border ${
                isScanning
                  ? 'bg-[#00d9ff]/15 text-[#00d9ff] border-[#00d9ff]/40 animate-pulse'
                  : 'bg-[#a855f7]/15 text-[#a855f7] border-[#a855f7]/40'
              }`}
            >
              {isScanning ? 'STREAMING' : 'COMPLETE'}
            </span>
          </div>
        </div>

        {/* Ordered SSE Stream Body */}
        <div className="h-[460px] overflow-y-auto p-4 space-y-2 font-mono text-xs">
          {events.length === 0 ? (
            <div className="h-full flex items-center justify-center text-zinc-500">
              <span>&gt; Connecting to /api/v2/scans/&#123;id&#125;/stream...</span>
            </div>
          ) : (
            events.map((ev, index) => {
              if (ev.type === 'crawl_progress') {
                return (
                  <div
                    key={`crawl-${index}`}
                    className="px-3 py-1.5 rounded bg-[#0a0a0a] border-l-2 border-[#00d9ff] text-[#00d9ff]"
                  >
                    ✓ Crawling: {ev.pages} pages, queue {ev.queue}
                  </div>
                );
              }

              if (ev.type === 'plan_ready') {
                return <ExpandablePlanTable key={`plan-${index}`} plan={ev.plan} />;
              }

              if (ev.type === 'raw_flag') {
                return (
                  <div
                    key={`flag-${ev.id}-${index}`}
                    className="px-3 py-1.5 rounded bg-amber-500/10 border-l-2 border-amber-400 text-amber-300"
                  >
                    → Flag: <span className="font-bold uppercase">{ev.module}</span> on{' '}
                    <span className="underline decoration-amber-500/40">{ev.url}</span>
                  </div>
                );
              }

              if (ev.type === 'triage_result') {
                const isConfirmed = ev.verdict === 'confirmed';
                const isRejected = ev.verdict === 'rejected';
                const pct = Math.round((ev.confidence <= 1 ? ev.confidence * 100 : ev.confidence));
                return (
                  <button
                    key={`triage-${ev.id}-${index}`}
                    type="button"
                    onClick={() => onSelectTriageFinding(ev.id)}
                    className={`w-full text-left px-3 py-2 rounded border-l-2 transition flex flex-wrap items-center justify-between gap-2 cursor-pointer ${
                      isConfirmed
                        ? 'bg-[#00d9ff]/10 hover:bg-[#00d9ff]/20 border-[#00d9ff] text-white shadow-[0_0_16px_rgba(0,217,255,0.12)]'
                        : isRejected
                        ? 'bg-[#a855f7]/10 hover:bg-[#a855f7]/20 border-[#a855f7] text-zinc-300'
                        : 'bg-amber-500/10 hover:bg-amber-500/20 border-amber-400 text-amber-200'
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`font-extrabold ${
                          isConfirmed ? 'text-[#00d9ff]' : isRejected ? 'text-[#a855f7]' : 'text-amber-300'
                        }`}
                      >
                        {isConfirmed
                          ? '✓ CONFIRMED'
                          : isRejected
                          ? '✗ REJECTED'
                          : '? NEEDS MORE EVIDENCE'}
                      </span>
                      {ev.module && (
                        <span className="uppercase font-bold text-white">{ev.module}</span>
                      )}
                      {ev.url && <span className="text-zinc-400">{ev.url}</span>}
                      <span className="px-2 py-0.5 rounded text-[10px] uppercase bg-black/70 border border-white/15 text-[#00d9ff]">
                        {ev.severity}
                      </span>
                      <span className="text-zinc-400">({pct}% confidence)</span>
                    </div>

                    <span className="inline-flex items-center gap-1 text-[11px] text-[#00d9ff]">
                      <span>Inspect in Tab B</span>
                      <ExternalLink className="w-3 h-3" />
                    </span>
                  </button>
                );
              }

              if (ev.type === 'roadmap_ready') {
                return (
                  <div
                    key={`rm-${index}`}
                    className="px-3.5 py-2.5 rounded-lg bg-[#00d9ff]/15 border border-[#00d9ff] text-[#00d9ff] font-bold shadow-[0_0_20px_rgba(0,217,255,0.25)]"
                  >
                    ✓ Scan complete — {ev.nodes} nodes, risk {ev.score}/100
                  </div>
                );
              }

              if (ev.type === 'error') {
                return (
                  <div
                    key={`err-${index}`}
                    className="px-3 py-2 rounded bg-red-500/15 border-l-2 border-red-500 text-red-300"
                  >
                    ✗ Error: {ev.message}
                  </div>
                );
              }

              return null;
            })
          )}
          <div ref={terminalEndRef} />
        </div>
      </div>

      {/* Collapsible "Live HTTP Request Log" Drawer at Bottom */}
      <div className="rounded-2xl bg-[#0a0a0a] border border-white/10 overflow-hidden">
        <button
          type="button"
          onClick={() => setLogDrawerOpen((prev) => !prev)}
          className="w-full px-5 py-3.5 flex items-center justify-between text-xs font-mono text-white hover:bg-white/[0.02] transition cursor-pointer"
        >
          <span className="flex items-center gap-2 font-bold">
            <Activity className="w-4 h-4 text-[#00d9ff]" />
            <span>Live HTTP Request Log (GET /api/v2/scans/&#123;id&#125;/requests)</span>
            <span className="px-2 py-0.5 rounded bg-[#00d9ff]/15 text-[#00d9ff] border border-[#00d9ff]/30 text-[10px]">
              {requestLogs.length} requests
            </span>
          </span>
          <span className="flex items-center gap-1 text-zinc-400">
            {logDrawerOpen ? (
              <>
                <span>Collapse</span>
                <ChevronDown className="w-4 h-4" />
              </>
            ) : (
              <>
                <span>Expand</span>
                <ChevronRight className="w-4 h-4" />
              </>
            )}
          </span>
        </button>

        {logDrawerOpen && (
          <div className="max-h-64 overflow-y-auto border-t border-white/10 bg-[#000000]">
            <table className="w-full text-left font-mono text-xs border-collapse">
              <thead>
                <tr className="bg-[#0a0a0a] text-[10px] uppercase text-zinc-500 border-b border-white/10">
                  <th className="py-2 px-4">Method</th>
                  <th className="py-2 px-4">URL</th>
                  <th className="py-2 px-4">Status</th>
                  <th className="py-2 px-4 text-right">Timing / Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {requestLogs.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-zinc-500">
                      Waiting for HTTP probe telemetry...
                    </td>
                  </tr>
                ) : (
                  requestLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-white/[0.02]">
                      <td className="py-2 px-4 font-bold text-[#a855f7]">{log.method}</td>
                      <td className="py-2 px-4 text-zinc-200 break-all">{log.url}</td>
                      <td className="py-2 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            (log.status ?? 200) >= 500
                              ? 'bg-red-500/20 text-red-300 border border-red-500/40'
                              : (log.status ?? 200) >= 400
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                              : 'bg-[#00d9ff]/15 text-[#00d9ff] border border-[#00d9ff]/30'
                          }`}
                        >
                          {log.status ?? '200'}
                        </span>
                      </td>
                      <td className="py-2 px-4 text-right text-zinc-500">{log.ts}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default TabLiveScan;

