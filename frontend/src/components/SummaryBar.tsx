import React from 'react';
import { RoadmapResponse } from '../types';
import { ShieldAlert, ArrowDownRight, Layers, Flame, CheckCircle } from 'lucide-react';

interface SummaryBarProps {
  roadmap: RoadmapResponse;
  onSelectNode: (nodeId: string) => void;
}

export const SummaryBar: React.FC<SummaryBarProps> = ({ roadmap, onSelectNode }) => {
  const { score, raw_count, confirmed_count, rejected_count, nodes } = roadmap;

  // Counts by severity among open nodes
  const counts = nodes.reduce(
    (acc, node) => {
      if (node.status === 'open') {
        acc[node.severity] = (acc[node.severity] || 0) + 1;
      }
      return acc;
    },
    { Critical: 0, High: 0, Medium: 0, Low: 0 } as Record<string, number>
  );

  // Top 3 priority fixes
  const topThree = nodes.filter((n) => n.status === 'open').slice(0, 3);

  // Color gradient based on score
  const scoreColor =
    score > 70
      ? 'text-red-400 border-red-500/40 bg-red-500/10'
      : score > 30
      ? 'text-amber-400 border-amber-500/40 bg-amber-500/10'
      : 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10';

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 backdrop-blur space-y-4">
      {/* Top metrics row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Risk Score Gauge */}
        <div className={`p-4 rounded-xl border flex items-center justify-between ${scoreColor}`}>
          <div>
            <div className="text-xs uppercase font-semibold tracking-wider text-slate-400">Total Risk Score</div>
            <div className="text-3xl font-extrabold tracking-tight mt-0.5 transition-all duration-700 ease-out">
              {score}
              <span className="text-sm font-normal text-slate-400"> / 100</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
              <ArrowDownRight className="w-3 h-3 text-emerald-400" />
              Recalculates instantly on retest
            </div>
          </div>
          <Flame className="w-8 h-8 opacity-60" />
        </div>

        {/* Pipeline Ablation (Raw -> Confirmed -> Rejected) */}
        <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/60 flex flex-col justify-between">
          <div className="text-xs uppercase font-semibold tracking-wider text-slate-400 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-cyan-400" />
            Triage Pipeline Ablation
          </div>
          <div className="flex items-center gap-2 mt-2 font-mono text-sm">
            <span className="text-slate-300 bg-slate-900 px-2 py-1 rounded border border-slate-800">
              {raw_count} <span className="text-[10px] text-slate-500">RAW</span>
            </span>
            <span className="text-slate-500">→</span>
            <span className="text-emerald-300 bg-emerald-950/50 px-2 py-1 rounded border border-emerald-900/60 font-bold">
              {confirmed_count} <span className="text-[10px] text-emerald-500">CONFIRMED</span>
            </span>
            <span className="text-slate-500">→</span>
            <span className="text-slate-400 bg-slate-900 px-2 py-1 rounded border border-slate-800 line-through">
              {rejected_count} <span className="text-[10px] text-red-400/80">FILTERED</span>
            </span>
          </div>
          <div className="text-[11px] text-cyan-400/80 mt-1">
            Eliminates false alarms via 2-agent debate
          </div>
        </div>

        {/* Severity Breakdown */}
        <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/60 flex flex-col justify-between">
          <div className="text-xs uppercase font-semibold tracking-wider text-slate-400">Open by Severity</div>
          <div className="grid grid-cols-4 gap-1.5 mt-2 text-center">
            <div className="bg-red-500/10 border border-red-500/30 rounded p-1">
              <div className="text-xs font-bold text-red-400">{counts.Critical}</div>
              <div className="text-[10px] text-slate-400">Crit</div>
            </div>
            <div className="bg-orange-500/10 border border-orange-500/30 rounded p-1">
              <div className="text-xs font-bold text-orange-400">{counts.High}</div>
              <div className="text-[10px] text-slate-400">High</div>
            </div>
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded p-1">
              <div className="text-xs font-bold text-yellow-400">{counts.Medium}</div>
              <div className="text-[10px] text-slate-400">Med</div>
            </div>
            <div className="bg-slate-500/10 border border-slate-500/30 rounded p-1">
              <div className="text-xs font-bold text-slate-300">{counts.Low}</div>
              <div className="text-[10px] text-slate-400">Low</div>
            </div>
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Weighted risk model</div>
        </div>

        {/* Repair Status */}
        <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/60 flex flex-col justify-between">
          <div className="text-xs uppercase font-semibold tracking-wider text-slate-400">Repair Progress</div>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-xs text-slate-300">
              {nodes.filter((n) => n.status === 'fixed').length} of {nodes.length} nodes fixed
            </span>
            <span className="text-xs font-mono font-bold text-emerald-400">
              {nodes.length > 0
                ? Math.round((nodes.filter((n) => n.status === 'fixed').length / nodes.length) * 100)
                : 0}
              %
            </span>
          </div>
          <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden mt-1.5">
            <div
              className="bg-emerald-500 h-full transition-all duration-500"
              style={{
                width: `${
                  nodes.length > 0
                    ? (nodes.filter((n) => n.status === 'fixed').length / nodes.length) * 100
                    : 0
                }%`,
              }}
            />
          </div>
          <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
            <CheckCircle className="w-3 h-3 text-emerald-400" /> 1-Click Retest verification
          </div>
        </div>
      </div>

      {/* "Fix These 3 First" Priority Action Banner */}
      {topThree.length > 0 && (
        <div className="border border-cyan-500/20 bg-cyan-950/20 rounded-lg p-3">
          <div className="text-xs font-semibold text-cyan-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <ShieldAlert className="w-3.5 h-3.5 text-cyan-400" />
            Fix These 3 First (Ordered by Severity & Architectural Impact)
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
            {topThree.map((node, idx) => (
              <button
                key={node.id}
                type="button"
                onClick={() => onSelectNode(node.id)}
                className="text-left bg-slate-900/90 hover:bg-slate-800/90 border border-slate-800 hover:border-cyan-500/50 p-2.5 rounded-lg transition group cursor-pointer"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-mono text-cyan-400 font-bold">#{idx + 1} PRIORITY</span>
                  <span
                    className={`text-[10px] font-semibold px-1.5 py-0.2 rounded ${
                      node.severity === 'Critical'
                        ? 'bg-red-500/20 text-red-300'
                        : node.severity === 'High'
                        ? 'bg-orange-500/20 text-orange-300'
                        : 'bg-yellow-500/20 text-yellow-300'
                    }`}
                  >
                    {node.severity}
                  </span>
                </div>
                <div className="text-xs font-semibold text-white group-hover:text-cyan-200 line-clamp-1">
                  {node.issue}
                </div>
                <div className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">
                  {node.root_cause}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

