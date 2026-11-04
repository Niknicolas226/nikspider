import React, { useState } from 'react';
import { GroundedFinding } from '../types';
import { EvidenceLink } from './AgentArguments/EvidenceLink';
import { CheckCircle2, Search, ShieldAlert, RefreshCw, Terminal } from 'lucide-react';

interface FindingsTableProps {
  findings: GroundedFinding[];
  onOpenEvidence: (evidenceId: string, finding: GroundedFinding, tab?: 'both' | 'request' | 'response') => void;
  onSelectFinding?: (finding: GroundedFinding) => void;
  onRetestFinding?: (finding: GroundedFinding) => Promise<boolean>;
}

export const FindingsTable: React.FC<FindingsTableProps> = ({
  findings,
  onOpenEvidence,
  onSelectFinding,
  onRetestFinding,
}) => {
  const [search, setSearch] = useState('');
  const [sevFilter, setSevFilter] = useState<'all' | 'critical' | 'high' | 'medium' | 'low'>('all');
  const [retestingId, setRetestingId] = useState<string | null>(null);

  const filtered = findings.filter((f) => {
    if (sevFilter !== 'all' && f.severity !== sevFilter) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      f.module.toLowerCase().includes(q) ||
      f.endpoint.toLowerCase().includes(q) ||
      f.owasp.toLowerCase().includes(q) ||
      f.evidence_id.toLowerCase().includes(q)
    );
  });

  const handleRetest = async (f: GroundedFinding) => {
    if (!onRetestFinding) return;
    setRetestingId(f.id);
    try {
      await onRetestFinding(f);
    } finally {
      setRetestingId(null);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-800 bg-[#080d1a]/90 overflow-hidden shadow-xl">
      {/* Table Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 bg-[#0b1222] border-b border-slate-800">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-cyan-400" />
          <h3 className="text-sm font-bold text-white">Confirmed Vulnerability Inventory</h3>
          <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800">
            {filtered.length} findings
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter module, endpoint, ev_id..."
              className="bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div className="flex items-center bg-slate-950 p-0.5 rounded-lg border border-slate-800 text-[11px] font-mono">
            {(['all', 'high', 'medium', 'low'] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSevFilter(s)}
                className={`px-2.5 py-1 rounded-md uppercase transition cursor-pointer ${
                  sevFilter === s
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table Content */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-800/80 text-[11px] font-mono uppercase text-slate-400 bg-slate-950/60">
              <th className="py-3 px-4">Severity</th>
              <th className="py-3 px-4">Module</th>
              <th className="py-3 px-4">Endpoint & Param</th>
              <th className="py-3 px-4">OWASP Category</th>
              <th className="py-3 px-4">Evidence ID</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 text-xs font-mono">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-slate-500">
                  No findings match the current filter.
                </td>
              </tr>
            ) : (
              filtered.map((f) => {
                const isFixed = f.status === 'fixed';
                return (
                  <tr
                    key={f.id}
                    onClick={() => onSelectFinding?.(f)}
                    className="hover:bg-slate-900/70 transition cursor-pointer"
                  >
                    <td className="py-3 px-4">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${
                          f.severity === 'critical' || f.severity === 'high'
                            ? 'bg-orange-500/20 text-orange-300 border-orange-500/40'
                            : f.severity === 'medium'
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                            : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                        }`}
                      >
                        {f.severity}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-bold text-white uppercase">{f.module}</td>
                    <td className="py-3 px-4">
                      <span className="text-cyan-300">{f.endpoint}</span>
                      {f.param && (
                        <span className="ml-2 text-[10px] text-purple-300 bg-purple-950/60 px-1.5 py-0.5 rounded border border-purple-500/30">
                          {f.param}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-300">{f.owasp}</td>
                    <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                      <EvidenceLink
                        evidenceId={f.evidence_id}
                        label={f.evidence_id}
                        onSelect={(evId) => onOpenEvidence(evId, f, 'both')}
                      />
                    </td>
                    <td className="py-3 px-4">
                      {isFixed ? (
                        <span className="inline-flex items-center gap-1 text-[#61f5ae] bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded-full text-[10px] font-bold">
                          <CheckCircle2 className="w-3 h-3" /> FIXED
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-amber-300 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded-full text-[10px]">
                          CONFIRMED
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => onOpenEvidence(f.evidence_id, f, 'request')}
                          className="px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 text-[11px] flex items-center gap-1 transition cursor-pointer"
                        >
                          <Terminal className="w-3 h-3 text-cyan-400" /> Raw Req
                        </button>
                        {onRetestFinding && (
                          <button
                            type="button"
                            onClick={() => handleRetest(f)}
                            disabled={retestingId === f.id || isFixed}
                            className="px-2.5 py-1 rounded bg-emerald-500/15 hover:bg-emerald-500/25 disabled:opacity-40 border border-emerald-500/40 text-[#61f5ae] text-[11px] flex items-center gap-1 transition cursor-pointer"
                          >
                            <RefreshCw className={`w-3 h-3 ${retestingId === f.id ? 'animate-spin' : ''}`} />
                            {isFixed ? 'Fixed' : 'Retest'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default FindingsTable;

