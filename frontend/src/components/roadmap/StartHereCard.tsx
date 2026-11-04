import React from 'react';
import { RoadmapNode, Severity } from '../../types';
import { getStartHereNode, SEVERITY_SCORES } from '../../utils/roadmapUtils';
import {
  Flame,
  Zap,
  ArrowRight,
  Sparkles,
  RotateCcw,
  Code,
  ShieldCheck,
} from 'lucide-react';

interface StartHereCardProps {
  nodes: RoadmapNode[];
  onSelectNode: (node: RoadmapNode) => void;
  onRetestNode: (node: RoadmapNode) => void;
  onOpenPromptBridge: (node: RoadmapNode) => void;
  retestingNodeId: string | null;
}

export const StartHereCard: React.FC<StartHereCardProps> = ({
  nodes,
  onSelectNode,
  onRetestNode,
  onOpenPromptBridge,
  retestingNodeId,
}) => {
  const node = getStartHereNode(nodes);

  if (!node) return null;

  const isRetesting = retestingNodeId === node.id;
  const impact = node.impact_score || SEVERITY_SCORES[node.severity] || 5;

  return (
    <div className="p-4 rounded-2xl bg-gradient-to-r from-purple-950/60 via-fuchsia-950/40 to-purple-950/60 border border-purple-400/50 shadow-[0_0_20px_rgba(168,85,247,0.25)] flex flex-wrap items-center justify-between gap-4 text-left animate-in fade-in duration-300">
      <div className="space-y-1 max-w-xl">
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-amber-400" />
            HIGHEST LEVERAGE FIX
          </span>
          <span className="text-xs font-mono text-zinc-400">
            Start Here Recommendation
          </span>
        </div>

        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <span>{node.issue}</span>
          <span className="text-xs font-mono font-normal text-purple-300 bg-purple-950/80 px-2 py-0.5 rounded border border-purple-500/30">
            {node.severity}
          </span>
          <span className="text-xs font-mono font-normal text-amber-300 bg-amber-950/80 px-2 py-0.5 rounded border border-amber-500/30">
            Effort: {node.effort || 'M'}
          </span>
        </h3>

        <p className="text-xs text-zinc-300 line-clamp-1">{node.root_cause}</p>

        <div className="text-[11px] font-mono text-zinc-400 flex items-center gap-3 pt-0.5">
          <span>Affects: <strong className="text-zinc-200">{node.affects?.length || 1} routes</strong></span>
          <span>•</span>
          <span>Impact: <strong className="text-emerald-400">-{impact} pts off Risk Score</strong></span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onRetestNode(node)}
          disabled={isRetesting}
          className="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs font-mono font-bold flex items-center gap-1.5 transition cursor-pointer shadow-[0_0_14px_rgba(168,85,247,0.4)]"
        >
          <RotateCcw className={`w-3.5 h-3.5 ${isRetesting ? 'animate-spin' : ''}`} />
          <span>{isRetesting ? 'Probing...' : '1-Click Retest'}</span>
        </button>

        <button
          type="button"
          onClick={() => onOpenPromptBridge(node)}
          className="px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-xs font-mono text-zinc-200 hover:text-white flex items-center gap-1.5 transition cursor-pointer"
        >
          <Code className="w-3.5 h-3.5 text-purple-400" />
          <span>Fix with AI</span>
        </button>

        <button
          type="button"
          onClick={() => onSelectNode(node)}
          className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-white transition cursor-pointer"
          title="View remediation steps"
        >
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

