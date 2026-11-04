import React, { useState } from 'react';
import { useScanStore, scanStore } from '../store/scanStore';
import { retestFindingDetailed, getRoadmap } from '../api/client';
import { StepNavFooter } from './StepNavFooter';
import {
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Flame,
  ShieldCheck,
  Sparkles,
  ExternalLink,
} from 'lucide-react';

export const StepRetestVerifyView: React.FC = () => {
  const roadmap = useScanStore((s) => s.roadmap);
  const scanId = useScanStore((s) => s.scanId);
  const retestHistory = useScanStore((s) => s.retestHistory);
  const riskScore = useScanStore((s) => s.kpis.riskScore ?? 0);

  const [activeRetestId, setActiveRetestId] = useState<string | null>(null);
  const [retestFeedback, setRetestFeedback] = useState<Record<string, { status: string; message: string; passed: boolean }>>({});

  const handleRetestFinding = async (nodeId: string, findingId: string) => {
    setActiveRetestId(findingId);
    try {
      const res = await retestFindingDetailed(findingId);

      setRetestFeedback((prev) => ({
        ...prev,
        [findingId]: {
          status: res.status,
          message: res.message,
          passed: res.passed,
        },
      }));

      scanStore.dispatch({
        type: 'RETEST_RESULT',
        payload: {
          findingId,
          nodeId,
          passed: res.passed,
          status: res.status,
          message: res.message,
          score: res.score,
        },
      });

      // Refetch full roadmap to sync server side calculations
      if (scanId) {
        const fresh = await getRoadmap(scanId);
        if (fresh) {
          scanStore.dispatch({ type: 'SET_ROADMAP', payload: fresh });
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Retest failed';
      setRetestFeedback((prev) => ({
        ...prev,
        [findingId]: {
          status: 'error',
          message: msg,
          passed: false,
        },
      }));
    } finally {
      setActiveRetestId(null);
    }
  };

  const openNodes = roadmap.nodes.filter((n) => n.status === 'open');
  const fixedNodes = roadmap.nodes.filter((n) => n.status === 'fixed');
  const allFixed = roadmap.nodes.length > 0 && openNodes.length === 0;

  return (
    <div className="space-y-6 text-left">
      {/* ═══════════════════════════════════════════════════════════════════
          HEADER & RISK POSTURE
      ═══════════════════════════════════════════════════════════════════ */}
      <div className="p-5 rounded-2xl bg-[#090514]/90 border border-purple-500/30 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-purple-600/30 border border-purple-400/40 text-purple-200 text-xs font-mono font-bold flex items-center justify-center">
              6
            </span>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <span>Close The Loop — Retest & Remediate Verification</span>
              {allFixed && (
                <span className="text-xs font-mono font-bold text-emerald-300 bg-emerald-950 px-2 py-0.5 rounded-full border border-emerald-500/40">
                  ALL VULNERABILITIES REMEDIATED
                </span>
              )}
            </h3>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Execute 1-click live probes against target endpoints. Patched vulnerabilities will update risk score to zero.
          </p>
        </div>

        <div className="flex items-center gap-3 font-mono text-xs">
          <div className="px-3.5 py-2 rounded-xl bg-black/60 border border-purple-500/25">
            <span className="text-zinc-400">Current Risk:</span>{' '}
            <span className="text-white font-bold">{riskScore}/100</span>
          </div>

          <div className="px-3.5 py-2 rounded-xl bg-emerald-950/40 border border-emerald-500/35 text-emerald-300">
            <span>{fixedNodes.length} Verified Fixed</span>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          NODES TO RETEST
      ═══════════════════════════════════════════════════════════════════ */}
      <div className="p-5 rounded-2xl bg-black/80 border border-purple-500/25 space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-mono uppercase tracking-wider text-purple-300 font-bold flex items-center gap-2">
            <RotateCcw className="w-4 h-4 text-purple-400" />
            Vulnerability Remediation Verifiers ({roadmap.nodes.length} Nodes)
          </h4>
          <span className="text-xs font-mono text-zinc-500">
            Click &quot;Retest Endpoint&quot; to execute active verification
          </span>
        </div>

        <div className="space-y-3">
          {roadmap.nodes.length === 0 ? (
            <div className="p-8 text-center text-xs font-mono text-zinc-500 border border-dashed border-zinc-800 rounded-xl">
              No findings available for verification yet. Complete Steps 1-5 first.
            </div>
          ) : (
            roadmap.nodes.map((node) => {
              const primaryFindingId = node.finding_ids?.[0] || node.id;
              const isRetesting = activeRetestId === primaryFindingId;
              const isFixed = node.status === 'fixed';
              const feedback = retestFeedback[primaryFindingId];

              return (
                <div
                  key={node.id}
                  className={`p-4 rounded-xl border transition-all ${
                    isFixed
                      ? 'bg-emerald-950/20 border-emerald-500/40'
                      : 'bg-black/60 border-purple-500/25'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                            node.severity === 'Critical'
                              ? 'bg-red-950 text-red-300 border border-red-500/40'
                              : node.severity === 'High'
                              ? 'bg-rose-950 text-rose-300 border border-rose-500/40'
                              : 'bg-amber-950 text-amber-300 border border-amber-500/40'
                          }`}
                        >
                          {node.severity}
                        </span>
                        <span className="text-sm font-bold text-white font-mono">
                          {node.issue}
                        </span>
                        {isFixed && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-400 font-bold">
                            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                            FIXED
                          </span>
                        )}
                      </div>

                      <div className="text-xs text-zinc-400 font-mono">
                        Root cause: <span className="text-zinc-200">{node.root_cause}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={isRetesting}
                        onClick={() => handleRetestFinding(node.id, primaryFindingId)}
                        className={`px-4 py-2 rounded-xl text-xs font-mono font-bold flex items-center gap-2 transition cursor-pointer ${
                          isFixed
                            ? 'bg-emerald-600/30 hover:bg-emerald-600/50 border border-emerald-400/50 text-emerald-200'
                            : 'bg-purple-600/30 hover:bg-purple-600/50 border border-purple-400/50 text-white shadow-[0_0_14px_rgba(168,85,247,0.3)]'
                        }`}
                      >
                        {isRetesting ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Probing Endpoint...</span>
                          </>
                        ) : (
                          <>
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>{isFixed ? 'Re-verify Patch' : 'Retest Endpoint'}</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Inline Retest Message */}
                  {feedback && (
                    <div
                      className={`mt-3 p-2.5 rounded-lg text-xs font-mono flex items-center gap-2 ${
                        feedback.passed
                          ? 'bg-emerald-950/40 border border-emerald-500/40 text-emerald-200'
                          : 'bg-amber-950/40 border border-amber-500/40 text-amber-200'
                      }`}
                    >
                      {feedback.passed ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                      )}
                      <span>
                        {feedback.passed
                          ? 'Fixed: Live probe re-execution confirmed the vulnerability is remediated.'
                          : 'Still vulnerable: Live probe re-execution still detected the signal.'}
                      </span>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          RETEST AUDIT HISTORY
      ═══════════════════════════════════════════════════════════════════ */}
      {retestHistory.length > 0 && (
        <div className="p-5 rounded-2xl bg-black/80 border border-purple-500/25 space-y-3">
          <h4 className="text-xs font-mono uppercase tracking-wider text-zinc-300 font-bold">
            Retest Audit Log ({retestHistory.length} Checks Executed)
          </h4>
          <div className="max-h-56 overflow-y-auto space-y-2 font-mono text-xs pr-1">
            {retestHistory.map((item) => (
              <div
                key={item.id}
                className="p-2.5 rounded-lg bg-black/60 border border-zinc-800 flex items-center justify-between gap-2"
              >
                <div className="flex items-center gap-2 truncate">
                  <span className="text-zinc-500 text-[10px]">{item.ts}</span>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                      item.passed ? 'bg-emerald-950 text-emerald-300' : 'bg-rose-950 text-rose-300'
                    }`}
                  >
                    {item.passed ? 'FIXED' : 'OPEN'}
                  </span>
                  <span className="text-zinc-300 truncate">
                    Finding {item.findingId.slice(0, 8)}: {item.message}
                  </span>
                </div>
                {typeof item.score === 'number' && (
                  <span className="text-purple-300 text-[11px] shrink-0">
                    New Score: {item.score}/100
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Step Navigation Footer */}
      <StepNavFooter currentStep={6} />
    </div>
  );
};

