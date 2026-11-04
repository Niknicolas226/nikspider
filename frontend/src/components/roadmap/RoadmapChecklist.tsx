import React from 'react';
import { RoadmapNode, Severity } from '../../types';
import { SEVERITY_SCORES } from '../../utils/roadmapUtils';
import {
  RotateCcw,
  CheckCircle2,
  Code,
  Flame,
  Zap,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';

interface RoadmapChecklistProps {
  nodes: RoadmapNode[];
  onSelectNode: (node: RoadmapNode) => void;
  onRetestNode: (node: RoadmapNode) => void;
  onOpenPromptBridge: (node: RoadmapNode) => void;
  onHoverNode: (node: RoadmapNode | null) => void;
  retestingNodeId: string | null;
}

export const RoadmapChecklist: React.FC<RoadmapChecklistProps> = ({
  nodes,
  onSelectNode,
  onRetestNode,
  onOpenPromptBridge,
  onHoverNode,
  retestingNodeId,
}) => {
  const severities: Severity[] = ['Critical', 'High', 'Medium', 'Low'];

  const severityBadgeColors: Record<Severity, string> = {
    Critical: 'text-rose-400 bg-rose-950/40 border-rose-500/40',
    High: 'text-amber-400 bg-amber-950/40 border-amber-500/40',
    Medium: 'text-yellow-300 bg-yellow-950/30 border-yellow-500/30',
    Low: 'text-blue-300 bg-blue-950/30 border-blue-500/30',
  };

  const effortColors: Record<'S' | 'M' | 'L', string> = {
    S: 'text-emerald-300 bg-emerald-950/50 border-emerald-500/30',
    M: 'text-yellow-300 bg-yellow-950/50 border-yellow-500/30',
    L: 'text-rose-300 bg-rose-950/50 border-rose-500/30',
  };

  return (
    <div className="space-y-6 text-left">
      {severities.map((sev) => {
        const group = nodes.filter((n) => n.severity === sev);
        if (group.length === 0) return null;

        return (
          <div key={sev} className="space-y-2.5">
            <div className="flex items-center justify-between pb-1 border-b border-purple-500/20 text-xs font-mono">
              <span className="flex items-center gap-2 font-bold text-white">
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    sev === 'Critical'
                      ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]'
                      : sev === 'High'
                      ? 'bg-amber-500'
                      : sev === 'Medium'
                      ? 'bg-yellow-500'
                      : 'bg-blue-500'
                  }`}
                />
                {sev} Remediation Items ({group.length})
              </span>
              <span className="text-zinc-500 text-[11px]">
                Weight: {SEVERITY_SCORES[sev]} pts each
              </span>
            </div>

            <div className="space-y-2">
              {group.map((node) => {
                const isFixed = node.status === 'fixed';
                const isRetesting = retestingNodeId === node.id;
                const impact = node.impact_score || SEVERITY_SCORES[node.severity] || 5;

                return (
                  <div
                    key={node.id}
                    onMouseEnter={() => onHoverNode(node)}
                    onMouseLeave={() => onHoverNode(null)}
                    className={`p-3.5 rounded-xl border transition-all duration-200 flex flex-wrap items-center justify-between gap-3 ${
                      isFixed
                        ? 'bg-emerald-950/20 border-emerald-500/40 text-zinc-400'
                        : 'bg-[#0b0616]/80 border-purple-500/20 hover:border-purple-400/60 hover:shadow-[0_0_18px_rgba(168,85,247,0.2)]'
                    }`}
                  >
                    {/* Left: Checkbox & Title */}
                    <div className="flex items-center gap-3 min-w-[260px] flex-1">
                      <button
                        type="button"
                        onClick={() => onRetestNode(node)}
                        disabled={isRetesting}
                        className={`w-5 h-5 rounded-lg border flex items-center justify-center transition cursor-pointer ${
                          isFixed
                            ? 'bg-emerald-500 border-emerald-400 text-black shadow-[0_0_10px_rgba(16,185,129,0.5)]'
                            : 'border-zinc-700 bg-black/60 hover:border-purple-400 text-transparent'
                        }`}
                        title={isFixed ? 'Remediated (Retest to re-verify)' : 'Click to run retest probe'}
                      >
                        {isFixed ? <CheckCircle2 className="w-3.5 h-3.5" /> : null}
                      </button>

                      <div
                        className="cursor-pointer space-y-0.5"
                        onClick={() => onSelectNode(node)}
                      >
                        <div
                          className={`text-xs font-bold font-mono ${
                            isFixed ? 'line-through text-zinc-400' : 'text-white'
                          }`}
                        >
                          {node.issue}
                        </div>
                        <div className="text-[11px] text-zinc-400 line-clamp-1 max-w-lg">
                          {node.root_cause}
                        </div>
                      </div>
                    </div>

                    {/* Middle: Badges */}
                    <div className="flex items-center gap-2 text-xs font-mono">
                      <span className="text-[11px] text-zinc-400 bg-black/60 px-2 py-0.5 rounded border border-zinc-800">
                        {node.affects?.length || 1} routes
                      </span>

                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full border font-bold ${
                          effortColors[node.effort || 'M']
                        }`}
                      >
                        Effort {node.effort || 'M'}
                      </span>

                      <span className="text-[10px] text-emerald-300 bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-500/30 font-bold">
                        -{impact} pts
                      </span>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onRetestNode(node)}
                        disabled={isRetesting}
                        className={`px-3 py-1.5 rounded-xl font-mono text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                          isFixed
                            ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700'
                            : 'bg-purple-600 hover:bg-purple-500 text-white shadow-[0_0_12px_rgba(168,85,247,0.35)]'
                        }`}
                      >
                        <RotateCcw className={`w-3 h-3 ${isRetesting ? 'animate-spin' : ''}`} />
                        <span>{isRetesting ? 'Probing...' : isFixed ? 'Re-verify' : 'Retest'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => onOpenPromptBridge(node)}
                        className="px-2.5 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 hover:text-white font-mono text-xs flex items-center gap-1 transition cursor-pointer"
                        title="Generate fix prompt for Claude Code or Cursor"
                      >
                        <Code className="w-3 h-3 text-purple-400" />
                        <span>AI Fix</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => onSelectNode(node)}
                        className="p-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-white transition cursor-pointer"
                        title="View details"
                      >
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};

