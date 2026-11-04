import React, { useState } from 'react';
import { TriageResult, Severity } from '../../types';
import {
  DebaterFilterTab,
  DebaterSortOption,
  filterAndSortFindings,
  computeDebaterSummary,
} from '../../utils/debaterUtils';
import {
  Search,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Filter,
  Shield,
  ShieldAlert,
  Flame,
  ArrowUpDown,
  Bug,
} from 'lucide-react';

interface FindingsListProps {
  findings: TriageResult[];
  rawFlagsCount: number;
  selectedFindingId: string | null;
  onSelectFinding: (finding: TriageResult) => void;
}

export const FindingsList: React.FC<FindingsListProps> = ({
  findings,
  rawFlagsCount,
  selectedFindingId,
  onSelectFinding,
}) => {
  const [filter, setFilter] = useState<DebaterFilterTab>('all');
  const [sortBy, setSortBy] = useState<DebaterSortOption>('severity');
  const [searchQuery, setSearchQuery] = useState('');

  const summary = computeDebaterSummary(findings, rawFlagsCount);
  const filteredList = filterAndSortFindings(findings, filter, sortBy, searchQuery);

  const severityBadgeColors: Record<Severity, string> = {
    Critical: 'text-rose-400 bg-rose-950/40 border-rose-500/40',
    High: 'text-amber-400 bg-amber-950/40 border-amber-500/40',
    Medium: 'text-yellow-300 bg-yellow-950/30 border-yellow-500/30',
    Low: 'text-blue-300 bg-blue-950/30 border-blue-500/30',
  };

  return (
    <div className="rounded-2xl bg-[#090514]/90 border border-purple-500/30 p-4 space-y-4 flex flex-col h-full text-left">
      {/* ═══════════════════════════════════════════════════════════════════
          SUMMARY STRIP
      ═══════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
        <div className="p-2.5 rounded-xl bg-purple-950/20 border border-purple-500/20">
          <div className="text-[10px] text-zinc-400 uppercase">Raw Flags</div>
          <div className="text-base font-bold text-purple-300">{summary.rawFlags}</div>
        </div>

        <div className="p-2.5 rounded-xl bg-emerald-950/20 border border-emerald-500/30">
          <div className="text-[10px] text-emerald-400 uppercase">Confirmed</div>
          <div className="text-base font-bold text-emerald-300">{summary.confirmed}</div>
        </div>

        <div className="p-2.5 rounded-xl bg-red-950/20 border border-red-500/30">
          <div className="text-[10px] text-red-400 uppercase">Rejected</div>
          <div className="text-base font-bold text-red-300">{summary.rejected}</div>
        </div>

        <div className="p-2.5 rounded-xl bg-cyan-950/20 border border-cyan-500/30">
          <div className="text-[10px] text-cyan-400 uppercase">False Alarms</div>
          <div className="text-base font-bold text-cyan-300">-{summary.falseAlarmsRemoved}</div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center gap-1 bg-black/60 p-1 rounded-xl border border-zinc-800 text-xs font-mono">
        <button
          type="button"
          onClick={() => setFilter('all')}
          className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
            filter === 'all'
              ? 'bg-purple-600 text-white font-bold shadow-[0_0_10px_rgba(168,85,247,0.3)]'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          All ({findings.length})
        </button>

        <button
          type="button"
          onClick={() => setFilter('confirmed')}
          className={`px-2.5 py-1 rounded-lg transition cursor-pointer flex items-center gap-1 ${
            filter === 'confirmed'
              ? 'bg-emerald-600 text-white font-bold shadow-[0_0_10px_rgba(16,185,129,0.3)]'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          <CheckCircle2 className="w-3 h-3 text-emerald-300" />
          <span>Confirmed ({summary.confirmed})</span>
        </button>

        <button
          type="button"
          onClick={() => setFilter('rejected')}
          className={`px-2.5 py-1 rounded-lg transition cursor-pointer flex items-center gap-1 ${
            filter === 'rejected'
              ? 'bg-red-600 text-white font-bold shadow-[0_0_10px_rgba(239,68,68,0.3)]'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          <XCircle className="w-3 h-3 text-red-300" />
          <span>Rejected ({summary.rejected})</span>
        </button>

        <button
          type="button"
          onClick={() => setFilter('needs_more_evidence')}
          className={`px-2.5 py-1 rounded-lg transition cursor-pointer flex items-center gap-1 ${
            filter === 'needs_more_evidence'
              ? 'bg-amber-600 text-white font-bold'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          <HelpCircle className="w-3 h-3 text-amber-300" />
          <span>Contested ({summary.needsEvidence})</span>
        </button>
      </div>

      {/* Search & Sort Row */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search endpoint or module..."
            className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-black/60 border border-zinc-800 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-purple-500 font-mono"
          />
        </div>

        <div className="flex items-center gap-1 bg-black/60 px-2 py-1.5 rounded-xl border border-zinc-800 text-xs font-mono text-zinc-400 shrink-0">
          <ArrowUpDown className="w-3 h-3 text-purple-400" />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as DebaterSortOption)}
            className="bg-transparent text-xs text-zinc-300 focus:outline-none cursor-pointer"
          >
            <option value="severity">Sort: Severity</option>
            <option value="confidence">Sort: Confidence</option>
            <option value="owasp">Sort: OWASP</option>
          </select>
        </div>
      </div>

      {/* Findings list */}
      <div className="space-y-2 overflow-y-auto max-h-[520px] flex-1 pr-1">
        {filteredList.length === 0 ? (
          <div className="p-8 text-center text-xs font-mono text-zinc-500 border border-dashed border-zinc-800 rounded-xl bg-black/40">
            No findings matching filters.
          </div>
        ) : (
          filteredList.map((f) => {
            const isSelected = f.id === selectedFindingId;
            const isConfirmed = f.verdict === 'confirmed';
            const isRejected = f.verdict === 'rejected';
            const confPct = Math.round((f.confidence ?? 0.85) * ((f.confidence ?? 0.85) <= 1 ? 100 : 1));

            return (
              <div
                key={f.id}
                onClick={() => onSelectFinding(f)}
                className={`p-3 rounded-xl border transition-all cursor-pointer text-left ${
                  isSelected
                    ? 'bg-purple-950/40 border-purple-400 shadow-[0_0_16px_rgba(168,85,247,0.3)] ring-1 ring-purple-400/50'
                    : 'bg-black/50 border-zinc-800/80 hover:border-purple-500/40 hover:bg-purple-950/10'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="p-1 rounded bg-purple-950 border border-purple-500/40 text-purple-300">
                      <Bug className="w-3.5 h-3.5" />
                    </span>
                    <span className="text-xs font-mono font-bold text-white uppercase">
                      {f.module || 'PROBE'}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 font-mono text-[10px]">
                    <span
                      className={`px-1.5 py-0.5 rounded border font-semibold ${
                        severityBadgeColors[f.severity] || severityBadgeColors.Medium
                      }`}
                    >
                      {f.severity}
                    </span>
                    {isConfirmed ? (
                      <span className="px-1.5 py-0.5 rounded bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 font-semibold">
                        ✓ Confirmed
                      </span>
                    ) : isRejected ? (
                      <span className="px-1.5 py-0.5 rounded bg-red-950/40 border border-red-500/40 text-red-300 font-semibold">
                        ✗ Rejected
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.5 rounded bg-amber-950/40 border border-amber-500/40 text-amber-300">
                        ? Contested
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-1.5 font-mono text-[11px] text-zinc-300 truncate">
                  {f.url || '/'}
                </div>

                {f.param && (
                  <div className="text-[10px] font-mono text-amber-400 mt-0.5">
                    Param: <span className="underline">{f.param}</span>
                  </div>
                )}

                <div className="mt-2 flex items-center justify-between text-[10px] font-mono text-zinc-500 pt-1 border-t border-zinc-800/60">
                  <span>{f.owasp?.split('-')[0] || 'A03:2021'}</span>
                  <span className="text-purple-300 font-semibold">{confPct}% confidence</span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

