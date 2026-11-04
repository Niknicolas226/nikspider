import React, { useState } from 'react';
import { TriageResult } from '../types';
import { HighlightEvidence } from './HighlightEvidence';
import { ShieldAlert, CheckCircle2, XCircle, HelpCircle, Code, Filter } from 'lucide-react';

interface DebatePanelProps {
  triageResults: TriageResult[];
}

export const DebatePanel: React.FC<DebatePanelProps> = ({ triageResults }) => {
  const [filterTab, setFilterTab] = useState<'all' | 'confirmed' | 'rejected'>('all');

  const filteredList = triageResults.filter((item) => {
    if (filterTab === 'confirmed') return item.verdict === 'confirmed';
    if (filterTab === 'rejected') return item.verdict === 'rejected';
    return true;
  });

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 backdrop-blur space-y-5">
      {/* Panel Header & Filter Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            Evidence Validation & Triage
            <span className="text-[11px] font-mono text-purple-300 bg-purple-950/60 border border-purple-500/30 px-2 py-0.5 rounded">
              Deterministic checks
            </span>
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Findings shown here passed the scanner's evidence validators. Severity and rationale are attached to each finding.
          </p>
        </div>

        {/* Tab Selector */}
        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
          <button
            type="button"
            onClick={() => setFilterTab('all')}
            className={`px-3 py-1 rounded transition cursor-pointer ${
              filterTab === 'all' ? 'bg-cyan-600 text-white font-medium' : 'text-slate-400 hover:text-white'
            }`}
          >
            All ({triageResults.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterTab('confirmed')}
            className={`px-3 py-1 rounded transition cursor-pointer flex items-center gap-1 ${
              filterTab === 'confirmed' ? 'bg-emerald-600 text-white font-medium' : 'text-slate-400 hover:text-white'
            }`}
          >
            <CheckCircle2 className="w-3 h-3 text-emerald-300" />
            Confirmed ({triageResults.filter((r) => r.verdict === 'confirmed').length})
          </button>
          <button
            type="button"
            onClick={() => setFilterTab('rejected')}
            className={`px-3 py-1 rounded transition cursor-pointer flex items-center gap-1 ${
              filterTab === 'rejected' ? 'bg-red-600 text-white font-medium' : 'text-slate-400 hover:text-white'
            }`}
          >
            <XCircle className="w-3 h-3 text-red-300" />
            Rejected ({triageResults.filter((r) => r.verdict === 'rejected').length})
          </button>
        </div>
      </div>

      {/* Cards List */}
      <div className="space-y-4">
        {filteredList.length === 0 ? (
          <div className="p-8 text-center border border-dashed border-slate-800 rounded-lg text-slate-500 text-xs">
            No triage records matching "{filterTab}" category.
          </div>
        ) : (
          filteredList.map((item) => {
            const isConfirmed = item.verdict === 'confirmed';
            const isRejected = item.verdict === 'rejected';

            return (
              <div
                key={item.id}
                className={`border rounded-xl p-4 transition-all ${
                  isConfirmed
                    ? 'bg-slate-900/90 border-slate-700/80 shadow-md shadow-emerald-950/20'
                    : 'bg-slate-950/70 border-slate-800/80 opacity-80'
                }`}
              >
                {/* Header row */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    {isConfirmed ? (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-0.5 rounded-full">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Confirmed Vulnerability
                      </span>
                    ) : isRejected ? (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-red-400 bg-red-500/10 border border-red-500/30 px-2.5 py-0.5 rounded-full">
                        <Filter className="w-3.5 h-3.5" /> False Positive Filtered
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-400 bg-amber-500/10 border border-amber-500/30 px-2.5 py-0.5 rounded-full">
                        <HelpCircle className="w-3.5 h-3.5" /> Needs More Evidence
                      </span>
                    )}

                    <span
                      className={`text-xs font-semibold px-2 py-0.5 rounded ${
                        item.severity === 'Critical'
                          ? 'bg-red-500/20 text-red-300 border border-red-500/40'
                          : item.severity === 'High'
                          ? 'bg-orange-500/20 text-orange-300 border border-orange-500/40'
                          : 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/40'
                      }`}
                    >
                      {item.severity}
                    </span>

                    <span className="text-[11px] font-mono text-slate-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                      {item.owasp}
                    </span>
                  </div>

                  <div className="text-xs font-mono text-slate-400 flex items-center gap-1">
                    <span>Confidence:</span>
                    <span className="text-cyan-300 font-bold">{Math.round(item.confidence * 100)}%</span>
                  </div>
                </div>

                {/* Validation rationale */}
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-1 mb-3">
                  <div className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <ShieldAlert className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Validation Rationale:</span>
                  </div>
                  <p className="text-xs text-slate-400">{item.reason}</p>
                </div>

                {/* Evidence & Signal Highlighting */}
                <div className="bg-slate-950/90 p-3 rounded-lg border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
                    <span className="flex items-center gap-1">
                      <Code className="w-3.5 h-3.5 text-cyan-400" /> Request & Signal
                    </span>
                    <span className="text-amber-400 text-[11px] font-semibold">{item.evidence.signal}</span>
                  </div>

                  <div className="bg-slate-900/90 p-2 rounded border border-slate-800 font-mono text-[11px] text-cyan-300 break-all select-all">
                    {item.evidence.request}
                  </div>

                  <div className="space-y-1 pt-1">
                    <div className="text-[10px] uppercase font-semibold text-slate-500 tracking-wider">
                      Response Excerpt (Marker Highlighted)
                    </div>
                    <div className="bg-slate-900/90 p-2.5 rounded border border-slate-800 max-h-36 overflow-y-auto">
                      <HighlightEvidence text={item.evidence.response_excerpt} signal={item.evidence.signal} />
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

