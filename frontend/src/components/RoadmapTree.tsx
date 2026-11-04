import React, { useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Node,
  Edge,
} from '@xyflow/react';
import { RoadmapNode } from '../types';
import { CustomRoadmapNode } from './CustomRoadmapNode';
import { GitBranch, BrainCircuit, Sparkles } from 'lucide-react';

interface RoadmapTreeProps {
  nodes: RoadmapNode[];
  onSelectNode: (node: RoadmapNode) => void;
  onOpenDebater?: () => void;
}

const nodeTypes = {
  custom: CustomRoadmapNode,
};

const SEVERITY_RANK: Record<string, number> = {
  Critical: 0,
  High: 1,
  Medium: 2,
  Low: 3,
};

export const RoadmapTree: React.FC<RoadmapTreeProps> = ({ nodes, onSelectNode, onOpenDebater }) => {
  const sortedNodes = useMemo(() => {
    return [...nodes].sort(
      (a, b) => (SEVERITY_RANK[a.severity] ?? 9) - (SEVERITY_RANK[b.severity] ?? 9)
    );
  }, [nodes]);

  const { flowNodes, flowEdges } = useMemo(() => {
    const fNodes: Node[] = [];
    const fEdges: Edge[] = [];

    const startX = 240;
    const startY = 40;
    const gapX = 340;
    const gapY = 175;

    fNodes.push({
      id: 'root-target-posture',
      type: 'default',
      data: { label: 'Target Repair DAG (Ordered Critical → Low)' },
      position: { x: startX + Math.max(0, (sortedNodes.length - 1) * gapX * 0.5), y: startY },
      style: {
        background: '#0a0a0a',
        color: '#00d9ff',
        border: '1px solid #00d9ff',
        borderRadius: '10px',
        fontFamily: 'ui-monospace, monospace',
        fontWeight: 'bold',
        fontSize: '12px',
        padding: '10px 18px',
        boxShadow: '0 0 24px rgba(0, 217, 255, 0.25)',
      },
    });

    sortedNodes.forEach((node, index) => {
      const posX = startX + index * gapX;
      const posY = startY + gapY;

      fNodes.push({
        id: node.id,
        type: 'custom',
        position: { x: posX, y: posY },
        data: {
          node,
          onSelect: onSelectNode,
        },
      });

      fEdges.push({
        id: `edge-root-${node.id}`,
        source: 'root-target-posture',
        target: node.id,
        animated: node.status === 'open',
        style: {
          stroke: node.status === 'fixed' ? '#10b981' : '#00d9ff',
          strokeWidth: 2,
        },
      });

      if (node.children && node.children.length > 0) {
        node.children.forEach((child, cIdx) => {
          const childX = posX + cIdx * 290;
          const childY = posY + gapY;

          fNodes.push({
            id: child.id,
            type: 'custom',
            position: { x: childX, y: childY },
            data: {
              node: child,
              onSelect: onSelectNode,
            },
          });

          fEdges.push({
            id: `edge-${node.id}-${child.id}`,
            source: node.id,
            target: child.id,
            animated: child.status === 'open',
            style: {
              stroke: child.status === 'fixed' ? '#10b981' : '#a855f7',
              strokeWidth: 2,
            },
          });
        });
      }
    });

    return { flowNodes: fNodes, flowEdges: fEdges };
  }, [sortedNodes, onSelectNode]);

  return (
    <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-white flex items-center gap-2 font-mono">
              <GitBranch className="w-4 h-4 text-[#00d9ff]" />
              <span>Root-Cause Repair DAG (Critical → High → Medium → Low)</span>
            </h3>
            <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-400/40 text-[10px] font-mono">
              <Sparkles className="w-3 h-3 text-purple-400" />
              <span>Meta Model (muse-wonder-1.0)</span>
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-0.5">
            Click any node to open the slide-over remediation drawer, generate a fix prompt, or execute a 1-click live retest.
          </p>
        </div>

        <div className="flex items-center gap-3 text-xs font-mono">
          <div className="flex items-center gap-3 text-zinc-400">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500" /> OPEN
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#10b981]" /> FIXED
            </span>
          </div>
          {onOpenDebater && (
            <button
              type="button"
              onClick={onOpenDebater}
              className="px-3 py-1.5 rounded-lg bg-purple-950/40 hover:bg-purple-900/50 border border-purple-500/40 text-xs text-purple-200 flex items-center gap-1.5 transition cursor-pointer"
            >
              <BrainCircuit className="w-3.5 h-3.5 text-pink-400" />
              <span>Agent Debater →</span>
            </button>
          )}
        </div>
      </div>

      {nodes.length === 0 ? (
        <div className="p-12 text-center border border-dashed border-white/10 rounded-xl bg-[#000000]/60 space-y-3 font-mono">
          <GitBranch className="w-8 h-8 text-cyan-400/60 mx-auto animate-pulse" />
          <div className="text-sm text-zinc-300 font-bold">No Roadmap Nodes Generated Yet</div>
          <p className="text-xs text-zinc-500 max-w-md mx-auto">
            Remediation nodes are clustered by Meta Muse (muse-wonder-1.0) once vulnerabilities are confirmed.
          </p>
          {onOpenDebater && (
            <button
              type="button"
              onClick={onOpenDebater}
              className="px-3 py-1.5 rounded-lg bg-purple-600/30 border border-purple-400/50 text-xs text-white inline-flex items-center gap-1.5 hover:bg-purple-600/50 cursor-pointer"
            >
              <BrainCircuit className="w-3.5 h-3.5 text-pink-300" />
              <span>Inspect Agent Debater</span>
            </button>
          )}
        </div>
      ) : (
        <div className="w-full h-[480px] bg-[#000000] rounded-xl border border-[#00d9ff]/25 overflow-hidden relative">
          <ReactFlow
            nodes={flowNodes}
            edges={flowEdges}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.22 }}
            minZoom={0.3}
            maxZoom={1.5}
            proOptions={{ hideAttribution: false }}
          >
            <Background color="#18181b" gap={24} size={1.2} />
            <Controls className="bg-[#0a0a0a] border-white/10 text-white fill-white stroke-white" />
            <MiniMap
              nodeColor={(n) => {
                if (n.id.startsWith('root')) return '#00d9ff';
                return '#a855f7';
              }}
              maskColor="rgba(0, 0, 0, 0.78)"
              className="bg-[#0a0a0a] border border-white/10 rounded-lg"
            />
          </ReactFlow>
        </div>
      )}
    </div>
  );
};

export default RoadmapTree;
