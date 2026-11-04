import React, { useState } from 'react';
import { RoadmapNode, Severity } from '../../types';
import { SEVERITY_SCORES } from '../../utils/roadmapUtils';
import {
  RotateCcw,
  CheckCircle2,
  Code,
  Flame,
  ArrowRight,
  ShieldCheck,
  Clock,
  Layers,
} from 'lucide-react';

interface RoadmapBoardProps {
  nodes: RoadmapNode[];
  onSelectNode: (node: RoadmapNode) => void;
  onRetestNode: (node: RoadmapNode) => void;
  onOpenPromptBridge: (node: RoadmapNode) => void;
  onHoverNode: (node: RoadmapNode | null) => void;
  retestingNodeId: string | null;
}

export type BoardColumnId = 'open' | 'in_progress' | 'ready_to_retest' | 'fixed';

export const RoadmapBoard: React.FC<RoadmapBoardProps> = ({
  nodes,
  onSelectNode,
  onRetestNode,
  onOpenPromptBridge,
  onHoverNode,
  retestingNodeId,
}) => {
  // Store local progress state for Kanban non-fixed columns (fixed is strictly backend-governed)
  const [boardColumnOverrides, setBoardColumnOverrides] = useState<
    Record<string, 'open' | 'in_progress' | 'ready_to_retest'>
  >({});

  const columns: Array<{ id: BoardColumnId; title: string; color: string; desc: string }> = [
    {
      id: 'open',
      title: 'Open Issues',
      color: 'border-rose-500/40 text-rose-300',
      desc: 'Pending remediation',
    },
    {
      id: 'in_progress',
      title: 'In Progress',
      color: 'border-amber-500/40 text-amber-300',
      desc: 'Active patch implementation',
    },
    {
      id: 'ready_to_retest',
      title: 'Ready to Retest',
      color: 'border-purple-500/40 text-purple-300',
      desc: 'Patched, awaiting verification',
    },
    {
      id: 'fixed',
      title: 'Fixed & Verified',
      color: 'border-emerald-500/40 text-emerald-300',
      desc: 'Backend probe validated',
    },
  ];

  const getNodeColumn = (node: RoadmapNode): BoardColumnId => {
    if (node.status === 'fixed') return 'fixed';
    return boardColumnOverrides[node.id] || 'open';
  };

  const handleMoveColumn = (nodeId: string, col: 'open' | 'in_progress' | 'ready_to_retest') => {
    setBoardColumnOverrides((prev) => ({ ...prev, [nodeId]: col }));
  };

  const severityBadgeColors: Record<Severity, string> = {
    Critical: 'text-rose-400 bg-rose-950/40 border-rose-500/40',
    High: 'text-amber-400 bg-amber-950/40 border-amber-500/40',
    Medium: 'text-yellow-300 bg-yellow-950/30 border-yellow-500/30',
    Low: 'text-blue-300 bg-blue-950/30 border-blue-500/30',
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 text-left items-start">
      {columns.map((col) => {
        const colNodes = nodes.filter((n) => getNodeColumn(n) === col.id);

        return (
          <div
            key={col.id}
            className="p-3.5 rounded-2xl bg-[#090514]/90 border border-purple-500/20 shadow-md space-y-3 flex flex-col min-h-[480px]"
          >
            {/* Column Header */}
            <div className={`pb-2 border-b border-zinc-800 flex items-center justify-between font-mono`}>
              <div>
                <span className={`text-xs font-bold ${col.color}`}>{col.title}</span>
                <div className="text-[10px] text-zinc-500">{col.desc}</div>
              </div>
              <span className="w-5 h-5 rounded-full bg-black/60 border border-zinc-800 text-[11px] font-bold text-zinc-300 flex items-center justify-center">
                {colNodes.length}
              </span>
            </div>

            {/* Column Cards */}
            <div className="space-y-2.5 flex-1 overflow-y-auto max-h-[600px] pr-0.5">
              {colNodes.length === 0 ? (
                <div className="p-6 text-center text-xs font-mono text-zinc-600 border border-dashed border-zinc-800/60 rounded-xl">
                  No items
                </div>
              ) : (
                colNodes.map((node) => {
                  const isRetesting = retestingNodeId === node.id;
                  const isFixed = node.status === 'fixed';
                  const impact = node.impact_score || SEVERITY_SCORES[node.severity] || 5;

                  return (
                    <div
                      key={node.id}
                      onMouseEnter={() => onHoverNode(node)}
                      onMouseLeave={() => onHoverNode(null)}
                      className={`p-3 rounded-xl border transition-all space-y-2.5 ${
                        isFixed
                          ? 'bg-emerald-950/20 border-emerald-500/40 text-zinc-300'
                          : 'bg-black/60 border-zinc-800 hover:border-purple-500/50 hover:shadow-[0_0_14px_rgba(168,85,247,0.25)]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1 text-[10px] font-mono">
                        <span
                          className={`px-1.5 py-0.5 rounded border font-bold ${
                            severityBadgeColors[node.severity] || severityBadgeColors.Medium
                          }`}
                        >
                          {node.severity}
                        </span>
                        <span className="text-emerald-400 font-bold">-{impact} pts</span>
                      </div>

                      <div
                        onClick={() => onSelectNode(node)}
                        className="cursor-pointer space-y-1"
                      >
                        <h4 className="text-xs font-bold text-white leading-snug line-clamp-2">
                          {node.issue}
                        </h4>
                        <p className="text-[11px] text-zinc-400 line-clamp-2">{node.root_cause}</p>
                      </div>

                      <div className="flex items-center justify-between text-[10px] font-mono text-zinc-500 pt-1 border-t border-zinc-800/60">
                        <span>{node.affects?.length || 1} routes</span>
                        <span>Effort: {node.effort || 'M'}</span>
                      </div>

                      {/* Quick action buttons */}
                      <div className="flex items-center gap-1.5 pt-1">
                        <button
                          type="button"
                          onClick={() => onRetestNode(node)}
                          disabled={isRetesting}
                          className="flex-1 py-1 px-2 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-mono text-[10px] font-bold flex items-center justify-center gap-1 transition cursor-pointer shadow-[0_0_10px_rgba(168,85,247,0.3)]"
                        >
                          <RotateCcw className={`w-3 h-3 ${isRetesting ? 'animate-spin' : ''}`} />
                          <span>{isRetesting ? 'Probing...' : isFixed ? 'Re-verify' : 'Retest'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => onOpenPromptBridge(node)}
                          className="py-1 px-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 hover:text-white font-mono text-[10px] flex items-center gap-1 transition cursor-pointer"
                        >
                          <Code className="w-3 h-3 text-purple-400" />
                          <span>AI Fix</span>
                        </button>
                      </div>

                      {/* Non-fixed workflow movement */}
                      {!isFixed && (
                        <div className="flex items-center justify-between text-[9px] font-mono text-zinc-400 bg-zinc-950/60 p-1 rounded border border-zinc-800">
                          <span>Status:</span>
                          <div className="flex items-center gap-1">
                            {col.id !== 'open' && (
                              <button
                                type="button"
                                onClick={() => handleMoveColumn(node.id, 'open')}
                                className="hover:text-purple-300 transition cursor-pointer"
                              >
                                [Open]
                              </button>
                            )}
                            {col.id !== 'in_progress' && (
                              <button
                                type="button"
                                onClick={() => handleMoveColumn(node.id, 'in_progress')}
                                className="hover:text-amber-300 transition cursor-pointer"
                              >
                                [Active]
                              </button>
                            )}
                            {col.id !== 'ready_to_retest' && (
                              <button
                                type="button"
                                onClick={() => handleMoveColumn(node.id, 'ready_to_retest')}
                                className="hover:text-cyan-300 transition cursor-pointer"
                              >
                                [Ready]
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

