import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { RoadmapNode } from '../types';
import { ShieldCheck } from 'lucide-react';

interface CustomNodeData {
  node: RoadmapNode;
  onSelect: (node: RoadmapNode) => void;
}

export const CustomRoadmapNode = memo(({ data }: { data: CustomNodeData }) => {
  const { node, onSelect } = data;
  const isFixed = node.status === 'fixed';

  const severityCardStyle = isFixed
    ? 'border-emerald-400 bg-[#0a0a0a] text-emerald-200 shadow-[0_0_28px_rgba(16,185,129,0.45)] animate-pulse'
    : node.severity === 'Critical'
    ? 'border-red-500 bg-[#0a0a0a] text-white hover:border-[#00d9ff] shadow-[0_0_22px_rgba(239,68,68,0.22)]'
    : node.severity === 'High'
    ? 'border-orange-500 bg-[#0a0a0a] text-white hover:border-[#00d9ff] shadow-[0_0_20px_rgba(249,115,22,0.18)]'
    : node.severity === 'Medium'
    ? 'border-amber-400 bg-[#0a0a0a] text-white hover:border-[#00d9ff]'
    : 'border-[#00d9ff]/60 bg-[#0a0a0a] text-white hover:border-[#00d9ff]';

  const sevPillStyle =
    node.severity === 'Critical'
      ? 'bg-red-500/20 text-red-300 border-red-500/50'
      : node.severity === 'High'
      ? 'bg-orange-500/20 text-orange-300 border-orange-500/50'
      : node.severity === 'Medium'
      ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
      : 'bg-[#00d9ff]/20 text-[#00d9ff] border-[#00d9ff]/50';

  return (
    <div
      onClick={() => onSelect(node)}
      className={`px-4 py-3.5 rounded-xl border-2 min-w-[270px] max-w-[320px] transition-all cursor-pointer font-mono ${severityCardStyle}`}
    >
      <Handle type="target" position={Position.Top} className="w-2.5 h-2.5 bg-[#00d9ff]" />

      {/* Top Header: Severity + OPEN (red) / FIXED (green) badge */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${sevPillStyle}`}>
          {node.severity}
        </span>

        {isFixed ? (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-emerald-500 text-black shadow-[0_0_14px_rgba(16,185,129,0.7)]">
            <ShieldCheck className="w-3 h-3" /> FIXED
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-red-500/25 text-red-300 border border-red-500/50">
            OPEN
          </span>
        )}
      </div>

      {/* Issue Title */}
      <div className="text-xs font-extrabold text-white line-clamp-2 leading-snug font-sans">
        {node.issue}
      </div>

      {/* Root Cause snippet */}
      <div className="text-[11px] text-zinc-400 line-clamp-1 mt-1.5 font-mono">
        {node.root_cause}
      </div>

      {/* Footer */}
      <div className="mt-2 pt-2 border-t border-white/10 flex items-center justify-between text-[10px] text-zinc-400">
        <span className="text-[#a855f7] truncate max-w-[160px]">{node.owasp}</span>
        <span className="text-[#00d9ff]">
          Resolves {node.resolves_count || 1}
        </span>
      </div>

      <Handle type="source" position={Position.Bottom} className="w-2.5 h-2.5 bg-[#a855f7]" />
    </div>
  );
});
