import React, { useState } from 'react';
import { useScanStore } from '../store/scanStore';
import { StepNavFooter } from './StepNavFooter';
import { Activity, Flag, FileCode, ChevronDown, ChevronUp, Layers, Terminal, Loader2 } from 'lucide-react';

export const StepLiveProbesView: React.FC = () => {
  const plan = useScanStore((s) => s.plan);
  const rawFlags = useScanStore((s) => s.rawFlags);
  const requests = useScanStore((s) => s.requests);
  const isRunning = useScanStore((s) => s.steps[3] === 'running');
  const isDone = useScanStore((s) => s.steps[3] === 'done');

  const [showRequests, setShowRequests] = useState(false);
  const [activeTab, setActiveTab] = useState<'plan' | 'flags' | 'requests'>('plan');

  return (
    <div className="space-y-6 text-left">
      {/* ═══════════════════════════════════════════════════════════════════
          HEADER & METRICS
      ═══════════════════════════════════════════════════════════════════ */}
      <div className="p-5 rounded-2xl bg-[#090514]/90 border border-purple-500/30 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-purple-600/30 border border-purple-400/40 text-purple-200 text-xs font-mono font-bold flex items-center justify-center">
              3
            </span>
            <h3 className="text-base font-bold text-white">
              SpiderPois — Live Probes & Test Plan Execution
            </h3>
            {isRunning && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-mono bg-purple-500/15 text-purple-300 border border-purple-400 animate-pulse">
                <Loader2 className="w-3 h-3 animate-spin" /> Fuzzing Probes Active
              </span>
            )}
            {isDone && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-mono bg-emerald-500/15 text-emerald-300 border border-emerald-500/40 font-semibold">
                ✓ Probing Complete
              </span>
            )}
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Dynamic execution of non-destructive probe payloads, differential response analysis, and request logging.
          </p>
        </div>

        {/* Tab switchers */}
        <div className="flex items-center gap-1 bg-black/70 p-1 rounded-xl border border-purple-500/30 text-xs font-mono">
          <button
            type="button"
            onClick={() => setActiveTab('plan')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
              activeTab === 'plan'
                ? 'bg-purple-600/40 text-white font-bold border border-purple-400'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Plan ({plan.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('flags')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
              activeTab === 'flags'
                ? 'bg-purple-600/40 text-white font-bold border border-purple-400'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Raw Flags ({rawFlags.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('requests')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
              activeTab === 'requests'
                ? 'bg-purple-600/40 text-white font-bold border border-purple-400'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            HTTP Logs ({requests.length})
          </button>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          TAB 1: TEST PLAN
      ═══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'plan' && (
        <div className="p-5 rounded-2xl bg-black/80 border border-purple-500/25 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-mono uppercase tracking-wider text-purple-300 font-bold flex items-center gap-2">
              <FileCode className="w-4 h-4 text-purple-400" />
              Compiled Test Plan ({plan.length} Routes Targeted)
            </h4>
            <span className="text-xs font-mono text-zinc-500">
              Generated from Stage 2 surface taxonomy
            </span>
          </div>

          <div className="max-h-96 overflow-y-auto space-y-2.5 pr-1">
            {plan.length === 0 ? (
              <div className="p-8 text-center text-xs font-mono text-zinc-500 border border-dashed border-zinc-800 rounded-xl">
                {isRunning ? 'Compiling test plan from surface discovery...' : 'No test plan compiled yet.'}
              </div>
            ) : (
              plan.map((item, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-xl bg-black/60 border border-purple-500/20 space-y-2"
                >
                  <div className="flex items-center justify-between gap-2 flex-wrap text-xs font-mono">
                    <span className="text-white font-semibold">{item.url}</span>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {item.checks.map((chk) => (
                        <span
                          key={chk}
                          className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-950/80 text-purple-300 border border-purple-500/30 uppercase"
                        >
                          {chk}
                        </span>
                      ))}
                    </div>
                  </div>
                  <p className="text-xs text-zinc-400 font-sans leading-relaxed">
                    <span className="text-zinc-500 font-mono text-[11px] mr-1">Rationale:</span>
                    {item.why}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          TAB 2: RAW FLAGS
      ═══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'flags' && (
        <div className="p-5 rounded-2xl bg-black/80 border border-purple-500/25 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-mono uppercase tracking-wider text-amber-300 font-bold flex items-center gap-2">
              <Flag className="w-4 h-4 text-amber-400" />
              Raw Anomaly Signals ({rawFlags.length})
            </h4>
            <span className="text-xs font-mono text-zinc-500">
              Unvetted signals fed into Stage 4 Agent Debater
            </span>
          </div>

          <div className="max-h-96 overflow-y-auto space-y-2 pr-1">
            {rawFlags.length === 0 ? (
              <div className="p-8 text-center text-xs font-mono text-zinc-500 border border-dashed border-zinc-800 rounded-xl">
                {isRunning
                  ? 'Fuzzing in progress... Anomalous responses will appear here.'
                  : 'No raw signals detected yet.'}
              </div>
            ) : (
              rawFlags.map((flag, idx) => (
                <div
                  key={flag.id || idx}
                  className="p-3 rounded-xl bg-black/60 border border-amber-500/25 flex items-center justify-between gap-3 text-xs font-mono"
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-amber-950/80 text-amber-300 border border-amber-500/40">
                      {flag.module}
                    </span>
                    <span className="text-white truncate">{flag.url}</span>
                  </div>
                  <span className="text-zinc-500 text-[11px] shrink-0 font-mono">
                    ID: {flag.id ? flag.id.slice(0, 8) : `#${idx + 1}`}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          TAB 3: COLLAPSIBLE HTTP REQUEST LOGS TABLE
      ═══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'requests' && (
        <div className="p-5 rounded-2xl bg-black/80 border border-purple-500/25 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-mono uppercase tracking-wider text-cyan-300 font-bold flex items-center gap-2">
              <Terminal className="w-4 h-4 text-cyan-400" />
              Auditable HTTP Request Stream ({requests.length} Requests)
            </h4>
            <span className="text-xs font-mono text-zinc-500">
              Captured via GuardedClient
            </span>
          </div>

          <div className="max-h-96 overflow-y-auto space-y-1.5 font-mono text-xs pr-1">
            {requests.length === 0 ? (
              <div className="p-8 text-center text-zinc-500 border border-dashed border-zinc-800 rounded-xl">
                No HTTP requests logged yet.
              </div>
            ) : (
              requests.map((r, idx) => (
                <div
                  key={r.id || idx}
                  className="p-2.5 rounded-lg bg-black/60 border border-zinc-800/80 flex items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-2 truncate">
                    <span className="text-zinc-500 text-[10px]">{r.ts ? r.ts.slice(11, 19) : ''}</span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-950 text-purple-300">
                      {r.method}
                    </span>
                    <span className="text-zinc-300 truncate">{r.url}</span>
                  </div>

                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      r.status && r.status >= 500
                        ? 'bg-red-950 text-red-300'
                        : r.status && r.status >= 400
                        ? 'bg-amber-950 text-amber-300'
                        : 'bg-emerald-950 text-emerald-300'
                    }`}
                  >
                    {r.status || '200'}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Footer Navigation */}
      <StepNavFooter currentStep={3} />
    </div>
  );
};

