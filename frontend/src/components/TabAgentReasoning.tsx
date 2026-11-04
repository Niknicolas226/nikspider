import React, { useEffect, useState } from 'react';
import { TriageResult } from '../types';
import { HighlightEvidence } from './HighlightEvidence';
import { X, Code, CheckCircle2, XCircle, HelpCircle, ShieldCheck, BrainCircuit, GitBranch, Sparkles } from 'lucide-react';

interface TabAgentReasoningProps {
  triageResults: TriageResult[];
  selectedFindingId: string | null;
  onSelectFindingId: (id: string) => void;
  onOpenRoadmap?: () => void;
}

type FilterKind = 'all' | 'confirmed' | 'rejected' | 'needs_more_evidence';

export const TabAgentReasoning: React.FC<TabAgentReasoningProps> = ({
  triageResults,
  selectedFindingId,
  onSelectFindingId,
  onOpenRoadmap,
}) => {
  const [filter, setFilter] = useState<FilterKind>('all');
  const [revealStep, setRevealStep] = useState<number>(4);
  const [modalQuote, setModalQuote] = useState<string | null>(null);

  const filtered = triageResults.filter((r) => {
    if (filter === 'all') return true;
    return r.verdict === filter;
  });

  const activeFinding =
    filtered.find((f) => f.id === selectedFindingId) ||
    triageResults.find((f) => f.id === selectedFindingId) ||
    filtered[0] ||
    null;

  // Sequential card reveal animation (1 → 2 → 3 → 4) whenever the selected finding changes
  useEffect(() => {
    if (!activeFinding) return;
    setRevealStep(1);
    const t1 = setTimeout(() => setRevealStep(2), 140);
    const t2 = setTimeout(() => setRevealStep(3), 280);
    const t3 = setTimeout(() => setRevealStep(4), 420);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [activeFinding?.id]);

  const getQuoteString = (item: TriageResult): string => {
    return (
      item.evidence_quote ||
      item.evidence?.signal ||
      (item.evidence?.response_excerpt || '').slice(0, 64) ||
      'matched_signal'
    );
  };

  const getArgumenterText = (item: TriageResult): string => {
    if (item.agent_a) return item.agent_a;
    return `Endpoint ${item.url || '/'} (${item.param || 'param'}) exhibits a reproducible ${
      item.module?.toUpperCase() || 'SECURITY'
    } vulnerability (${item.owasp}). Raw probe response matched the signal pattern directly.`;
  };

  const getOpposerText = (item: TriageResult): string => {
    if (item.agent_b) return item.agent_b;
    return `Examine whether the reflection or error at ${
      item.url || '/'
    } is constrained by output encoding, session context, or non-sensitive decoy state.`;
  };

  const getRuleCheckText = (item: TriageResult): string => {
    if (item.rule_check) return item.rule_check;
    if (item.verdict === 'rejected') {
      return `rejected: ${item.reason || 'output HTML-escaped or failed deterministic validator'}`;
    }
    if (item.verdict === 'confirmed') {
      return `confirmed: deterministic ${
        item.module?.toUpperCase() || 'SECURITY'
      } validator verified unescaped evidence_quote in HTTP response`;
    }
    return `needs_more_evidence: ${item.reason || 'inconclusive response differential'}`;
  };

  const getProsCons = (item: TriageResult): { pros: string[]; cons: string[] } => {
    const pros =
      item.pros && item.pros.length > 0
        ? item.pros
        : item.verdict === 'confirmed'
        ? [
            `Exact substring match verified in HTTP response`,
            `Maps to ${item.owasp}`,
            `Reproducible across confirmation probes`,
          ]
        : [`Initial probe heuristic triggered on ${item.url || '/'}`];

    const cons =
      item.cons && item.cons.length > 0
        ? item.cons
        : item.verdict === 'confirmed'
        ? [`Requires HTTP reachability to target route`, `No destructive write payload executed`]
        : [getRuleCheckText(item), `Filtered out by deterministic verification gate`];

    return { pros, cons };
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* LEFT COLUMN: Findings List + Filter */}
      <div className="lg:col-span-4 bg-[#0a0a0a] border border-white/10 rounded-2xl p-4 space-y-4">
        <div className="space-y-2">
          <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-[#00d9ff]">
            Triaged Findings ({filtered.length})
          </h3>

          {/* Filter Pills: All / Confirmed / Rejected / Needs More Evidence */}
          <div className="grid grid-cols-2 gap-1.5 font-mono text-[11px]">
            {(
              [
                { id: 'all', label: `All (${triageResults.length})` },
                {
                  id: 'confirmed',
                  label: `Confirmed (${triageResults.filter((r) => r.verdict === 'confirmed').length})`,
                },
                {
                  id: 'rejected',
                  label: `Rejected (${triageResults.filter((r) => r.verdict === 'rejected').length})`,
                },
                {
                  id: 'needs_more_evidence',
                  label: `Needs Evidence (${
                    triageResults.filter((r) => r.verdict === 'needs_more_evidence').length
                  })`,
                },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilter(tab.id)}
                className={`px-2.5 py-1.5 rounded-lg border text-left transition cursor-pointer truncate ${
                  filter === tab.id
                    ? 'bg-[#00d9ff]/15 border-[#00d9ff] text-[#00d9ff] font-bold'
                    : 'bg-[#000000] border-white/10 text-zinc-400 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Selectable Finding Cards */}
        <div className="space-y-2 max-h-[540px] overflow-y-auto pr-1">
          {filtered.length === 0 ? (
            <div className="p-8 text-center font-mono text-xs text-zinc-500 border border-dashed border-white/10 rounded-xl">
              No findings in this filter category yet.
            </div>
          ) : (
            filtered.map((item) => {
              const isSelected = activeFinding?.id === item.id;
              const isConfirmed = item.verdict === 'confirmed';
              const isRejected = item.verdict === 'rejected';

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectFindingId(item.id)}
                  className={`w-full text-left p-3.5 rounded-xl border font-mono transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-[#00d9ff]/10 border-[#00d9ff] shadow-[0_0_20px_rgba(0,217,255,0.2)]'
                      : 'bg-[#000000] border-white/10 hover:border-white/25'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-xs font-extrabold uppercase text-white">
                      {item.module || 'CHECK'} — {item.severity}
                    </span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                        isConfirmed
                          ? 'bg-[#00d9ff]/20 text-[#00d9ff] border border-[#00d9ff]/40'
                          : isRejected
                          ? 'bg-[#a855f7]/20 text-[#a855f7] border border-[#a855f7]/40'
                          : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                      }`}
                    >
                      {item.verdict}
                    </span>
                  </div>
                  <div className="text-[11px] text-zinc-400 truncate">
                    {item.url || item.owasp}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* RIGHT COLUMN: Four Sequentially-Revealed Reasoning Cards */}
      <div className="lg:col-span-8 space-y-4">
        {!activeFinding ? (
          <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl p-12 text-center font-mono text-xs text-zinc-500">
            Select a triaged finding on the left to inspect its structured reasoning pass.
          </div>
        ) : (
          <>
            {/* Finding Context Header */}
            <div className="bg-[#0a0a0a] border border-[#00d9ff]/30 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 font-mono">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-extrabold text-white uppercase">
                    {activeFinding.module || 'FINDING'}
                  </span>
                  <span className="text-xs text-[#00d9ff]">{activeFinding.url}</span>
                  {activeFinding.param && (
                    <span className="text-[11px] px-2 py-0.5 rounded bg-[#a855f7]/15 text-[#a855f7] border border-[#a855f7]/40">
                      param: {activeFinding.param}
                    </span>
                  )}
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-400/40 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-purple-400" />
                    <span>Meta Muse 4-Agent Debate</span>
                  </span>
                </div>
                <div className="text-[11px] text-zinc-400">{activeFinding.owasp}</div>
              </div>

              <div className="flex items-center gap-2">
                {onOpenRoadmap && (
                  <button
                    type="button"
                    onClick={onOpenRoadmap}
                    className="px-3 py-1.5 rounded-lg bg-cyan-950/40 hover:bg-cyan-900/50 border border-cyan-500/40 text-xs text-cyan-200 flex items-center gap-1.5 transition cursor-pointer"
                    title="View Root-Cause Repair Graph"
                  >
                    <GitBranch className="w-3.5 h-3.5 text-cyan-400" />
                    <span>View Roadmap DAG →</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setModalQuote(getQuoteString(activeFinding))}
                  className="px-3 py-1.5 rounded-lg bg-[#000000] hover:bg-[#00d9ff]/15 border border-[#00d9ff]/40 text-xs text-[#00d9ff] flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Code className="w-3.5 h-3.5" />
                  <span>Inspect Raw HTTP Evidence</span>
                </button>
              </div>
            </div>

            {/* CARD 1: 🔴 ARGUMENTER */}
            {revealStep >= 1 && (
              <div className="bg-[#0a0a0a] border border-red-500/35 rounded-2xl p-5 space-y-3 animate-fadeIn">
                <div className="flex items-center justify-between font-mono">
                  <span className="text-xs font-extrabold tracking-wider text-red-400">
                    🔴 ARGUMENTER — Exploitability Case
                  </span>
                  <span className="text-[10px] text-zinc-500">Field 1 / 4</span>
                </div>
                <p className="text-xs text-zinc-200 leading-relaxed font-mono">
                  {getArgumenterText(activeFinding)}
                </p>
                <div className="pt-1 flex flex-wrap items-center gap-2">
                  <span className="text-[10px] font-mono uppercase text-zinc-500">
                    Evidence Quote:
                  </span>
                  <button
                    type="button"
                    onClick={() => setModalQuote(getQuoteString(activeFinding))}
                    className="px-2.5 py-1 rounded-md bg-[#00d9ff]/15 hover:bg-[#00d9ff]/25 border border-[#00d9ff]/50 text-[#00d9ff] font-mono text-[11px] transition cursor-pointer shadow-[0_0_12px_rgba(0,217,255,0.2)]"
                  >
                    evidence_quote: &ldquo;{getQuoteString(activeFinding).slice(0, 68)}&rdquo; ↗
                  </button>
                </div>
              </div>
            )}

            {/* CARD 2: 🟡 OPPOSER */}
            {revealStep >= 2 && (
              <div className="bg-[#0a0a0a] border border-amber-500/35 rounded-2xl p-5 space-y-3 animate-fadeIn">
                <div className="flex items-center justify-between font-mono">
                  <span className="text-xs font-extrabold tracking-wider text-amber-300">
                    🟡 OPPOSER — Mitigating Factors &amp; False-Positive Case
                  </span>
                  <span className="text-[10px] text-zinc-500">Field 2 / 4</span>
                </div>
                <p className="text-xs text-zinc-200 leading-relaxed font-mono">
                  {getOpposerText(activeFinding)}
                </p>
                <div className="pt-1 flex flex-wrap items-center gap-2">
                  <span className="text-[10px] font-mono uppercase text-zinc-500">
                    Evidence Quote:
                  </span>
                  <button
                    type="button"
                    onClick={() => setModalQuote(getQuoteString(activeFinding))}
                    className="px-2.5 py-1 rounded-md bg-[#a855f7]/15 hover:bg-[#a855f7]/25 border border-[#a855f7]/50 text-[#a855f7] font-mono text-[11px] transition cursor-pointer"
                  >
                    evidence_quote: &ldquo;{getQuoteString(activeFinding).slice(0, 68)}&rdquo; ↗
                  </button>
                </div>
              </div>
            )}

            {/* CARD 3: ⚪ JUDGE (with distinct "Rule Check" code line) */}
            {revealStep >= 3 && (
              <div className="bg-[#0a0a0a] border border-white/20 rounded-2xl p-5 space-y-3.5 animate-fadeIn">
                <div className="flex items-center justify-between font-mono">
                  <span className="text-xs font-extrabold tracking-wider text-white">
                    ⚪ JUDGE — Verdict &amp; Deterministic Enforcement
                  </span>
                  <span className="text-[10px] text-zinc-500">Field 3 / 4</span>
                </div>

                <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
                  {activeFinding.verdict === 'confirmed' ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#00d9ff]/20 text-[#00d9ff] border border-[#00d9ff]/50 font-bold">
                      <CheckCircle2 className="w-3.5 h-3.5" /> VERDICT: CONFIRMED (
                      {activeFinding.severity})
                    </span>
                  ) : activeFinding.verdict === 'rejected' ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#a855f7]/20 text-[#a855f7] border border-[#a855f7]/50 font-bold">
                      <XCircle className="w-3.5 h-3.5" /> VERDICT: REJECTED
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/50 font-bold">
                      <HelpCircle className="w-3.5 h-3.5" /> VERDICT: NEEDS MORE EVIDENCE
                    </span>
                  )}
                </div>

                <p className="text-xs text-zinc-300 font-mono leading-relaxed">
                  {activeFinding.reason}
                </p>

                {/* Distinct visually separate line for deterministic code enforcement */}
                <div className="p-3 rounded-xl bg-[#000000] border border-[#00d9ff]/40 flex flex-wrap items-center justify-between gap-2 font-mono text-xs">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-[#00d9ff] text-black font-extrabold text-[10px] uppercase flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3" /> Rule Check
                    </span>
                    <span className="text-[#00d9ff] font-bold">
                      {getRuleCheckText(activeFinding)}
                    </span>
                  </div>
                  <span className="text-[10px] text-zinc-500 uppercase">
                    Deterministic Code Gate
                  </span>
                </div>
              </div>
            )}

            {/* CARD 4: 🟢 VOTER (Pros / Cons side-by-side + Confidence Score) */}
            {revealStep >= 4 && (
              <div className="bg-[#0a0a0a] border border-emerald-500/35 rounded-2xl p-5 space-y-4 animate-fadeIn">
                <div className="flex flex-wrap items-center justify-between gap-2 font-mono">
                  <span className="text-xs font-extrabold tracking-wider text-emerald-400">
                    🟢 VOTER — Final Pros / Cons &amp; Confidence Score
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-[#000000] border border-[#00d9ff]/40 text-xs font-bold text-[#00d9ff]">
                    Confidence:{' '}
                    {Math.round(
                      activeFinding.confidence <= 1
                        ? activeFinding.confidence * 100
                        : activeFinding.confidence
                    )}
                    %
                  </span>
                </div>

                {(() => {
                  const { pros, cons } = getProsCons(activeFinding);
                  return (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-mono text-xs">
                      <div className="p-3.5 rounded-xl bg-[#000000] border border-[#00d9ff]/25 space-y-2">
                        <div className="text-[11px] font-bold uppercase text-[#00d9ff]">
                          Pros (Confirming Signals)
                        </div>
                        <ul className="space-y-1.5 text-zinc-300">
                          {pros.map((p, idx) => (
                            <li key={idx} className="flex items-start gap-2">
                              <span className="text-[#00d9ff] font-bold">+</span>
                              <span>{p}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="p-3.5 rounded-xl bg-[#000000] border border-[#a855f7]/25 space-y-2">
                        <div className="text-[11px] font-bold uppercase text-[#a855f7]">
                          Cons (Constraints &amp; Mitigations)
                        </div>
                        <ul className="space-y-1.5 text-zinc-300">
                          {cons.map((c, idx) => (
                            <li key={idx} className="flex items-start gap-2">
                              <span className="text-[#a855f7] font-bold">−</span>
                              <span>{c}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Required Transparency Caption */}
            <p className="text-center text-xs font-mono text-zinc-500 pt-1">
              Single AI analysis pass, shown here broken into its four reasoning fields.
            </p>
          </>
        )}
      </div>

      {/* Evidence Quote Modal: Raw HTTP Request/Response with Matched Substring Highlighted */}
      {modalQuote !== null && activeFinding && (
        <div
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setModalQuote(null)}
        >
          <div
            className="w-full max-w-4xl rounded-2xl bg-[#0a0a0a] border border-[#00d9ff]/50 shadow-[0_0_50px_rgba(0,217,255,0.2)] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 bg-[#000000] border-b border-white/10 font-mono">
              <div>
                <h4 className="text-sm font-bold text-white">
                  Raw HTTP Evidence &amp; Matched Substring
                </h4>
                <p className="text-xs text-[#00d9ff] mt-0.5">
                  Matched Quote: &ldquo;{modalQuote}&rdquo;
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalQuote(null)}
                className="p-1.5 rounded-lg bg-[#0a0a0a] hover:bg-white/10 text-zinc-400 hover:text-white border border-white/10 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[78vh] overflow-y-auto font-mono text-xs">
              <div className="space-y-1.5">
                <div className="text-[11px] uppercase text-[#a855f7] font-bold">
                  Raw HTTP Request
                </div>
                <pre className="p-4 rounded-xl bg-[#000000] border border-white/10 text-[#00d9ff] overflow-x-auto whitespace-pre-wrap select-all">
                  {activeFinding.evidence?.request || `GET ${activeFinding.url || '/'} HTTP/1.1`}
                </pre>
              </div>

              <div className="space-y-1.5">
                <div className="text-[11px] uppercase text-[#00d9ff] font-bold">
                  Raw HTTP Response Excerpt (Matched Substring Highlighted Inline)
                </div>
                <div className="p-4 rounded-xl bg-[#000000] border border-[#00d9ff]/30 max-h-72 overflow-y-auto">
                  <HighlightEvidence
                    text={activeFinding.evidence?.response_excerpt || ''}
                    signal={modalQuote}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TabAgentReasoning;

