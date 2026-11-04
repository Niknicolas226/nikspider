import React from 'react';
import { RoadmapNode } from '../../types';
import { RoadmapFilter } from '../../utils/roadmapUtils';
import { WhyThisOrder } from './WhyThisOrder';
import {
  Flame,
  ShieldCheck,
  Zap,
  Target,
  Sparkles,
  PartyPopper,
  CheckCircle2,
} from 'lucide-react';

interface RoadmapHeroProps {
  nodes: RoadmapNode[];
  initialScore: number;
  currentScore: number;
  projectedScore: number | null;
  activeFilter: RoadmapFilter;
  onFilterChange: (f: RoadmapFilter) => void;
}

export const RoadmapHero: React.FC<RoadmapHeroProps> = ({
  nodes,
  initialScore,
  currentScore,
  projectedScore,
  activeFilter,
  onFilterChange,
}) => {
  const fixedCount = nodes.filter((n) => n.status === 'fixed').length;
  const totalCount = nodes.length;
  const isAllFixed = totalCount > 0 && fixedCount === totalCount;
  const progressPct = totalCount > 0 ? Math.round((fixedCount / totalCount) * 100) : 0;

  const displayScore = projectedScore !== null ? projectedScore : currentScore;

  return (
    <div className="p-5 rounded-2xl bg-[#090514]/90 border border-purple-500/30 shadow-[0_0_24px_rgba(168,85,247,0.2)] backdrop-blur-xl space-y-4 text-left">
      {/* Celebration Banner when 100% fixed */}
      {isAllFixed && (
        <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-950/80 via-emerald-900/60 to-emerald-950/80 border-2 border-emerald-400 shadow-[0_0_25px_rgba(16,185,129,0.4)] flex items-center justify-between gap-3 text-emerald-200 animate-bounce">
          <div className="flex items-center gap-3">
            <PartyPopper className="w-6 h-6 text-emerald-300" />
            <div>
              <div className="text-sm font-bold text-white uppercase tracking-wider font-mono">
                🎉 Remediation Milestone Achieved!
              </div>
              <div className="text-xs text-emerald-300">
                All identified vulnerability root causes have passed deterministic retest probes. Target risk is 0/100.
              </div>
            </div>
          </div>
          <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-emerald-500/30 border border-emerald-400 text-emerald-200">
            Target Secured
          </span>
        </div>
      )}

      {/* Main Stats Row */}
      <div className="flex flex-wrap items-center justify-between gap-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-purple-600/30 border border-purple-400/50 text-purple-200 text-xs font-mono font-bold flex items-center justify-center">
              5
            </span>
            <h2 className="text-base font-bold text-white tracking-wide">
              Root-Cause Remediation Roadmap
            </h2>
            <span className="text-xs font-mono text-purple-300 bg-purple-950 px-2 py-0.5 rounded-full border border-purple-500/30">
              Deterministic DAG
            </span>
          </div>
          <p className="text-xs text-zinc-400">
            Deduplicated security engineering roadmap. Retest endpoints in 1-click or generate fixes for Claude / Cursor.
          </p>
        </div>

        {/* Score Ring & Progression */}
        <div className="flex items-center gap-4 bg-black/60 p-3 rounded-2xl border border-purple-500/20 font-mono text-xs">
          <div>
            <div className="text-[10px] text-zinc-500 uppercase">Starting Risk</div>
            <div className="text-sm font-bold text-zinc-400 line-through">
              {Math.max(initialScore, currentScore)}/100
            </div>
          </div>

          <div className="text-zinc-600">→</div>

          <div>
            <div className="text-[10px] text-purple-400 uppercase">Current Risk</div>
            <div
              className={`text-lg font-bold transition-all ${
                displayScore === 0
                  ? 'text-emerald-400'
                  : displayScore < 30
                  ? 'text-yellow-400'
                  : 'text-rose-400'
              }`}
            >
              {displayScore}
              <span className="text-xs text-zinc-500">/100</span>
              {projectedScore !== null && projectedScore !== currentScore && (
                <span className="text-[10px] text-emerald-400 ml-1">
                  (Preview: -{currentScore - projectedScore} pts)
                </span>
              )}
            </div>
          </div>

          <div className="text-zinc-600">→</div>

          <div>
            <div className="text-[10px] text-emerald-400 uppercase">Target</div>
            <div className="text-sm font-bold text-emerald-400 flex items-center gap-1">
              <Target className="w-3.5 h-3.5" />
              <span>0/100</span>
            </div>
          </div>
        </div>
      </div>

      {/* Retest timeline progress bar */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs font-mono">
          <div className="flex items-center gap-2">
            <span className="text-zinc-400">Remediation Progress:</span>
            <span className="text-emerald-400 font-bold">
              {fixedCount} / {totalCount} nodes resolved
            </span>
          </div>
          <span className="text-purple-300 font-bold">{progressPct}% Complete</span>
        </div>

        <div className="w-full h-2.5 rounded-full bg-zinc-950 border border-zinc-800 flex overflow-hidden p-0.5">
          {nodes.map((node) => {
            const isFixed = node.status === 'fixed';
            return (
              <div
                key={node.id}
                title={`${node.issue} (${isFixed ? 'Fixed' : 'Open'})`}
                className={`h-full flex-1 mx-0.5 rounded transition-all duration-300 ${
                  isFixed
                    ? 'bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.7)]'
                    : 'bg-zinc-800'
                }`}
              />
            );
          })}
        </div>
      </div>

      {/* Quick Filter buttons & "Why this order?" */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-purple-500/10">
        <div className="flex items-center gap-1.5 bg-black/60 p-1 rounded-xl border border-zinc-800 text-xs font-mono">
          <button
            type="button"
            onClick={() => onFilterChange('all')}
            className={`px-3 py-1 rounded-lg transition cursor-pointer ${
              activeFilter === 'all'
                ? 'bg-purple-600 text-white font-bold shadow-[0_0_10px_rgba(168,85,247,0.3)]'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            All Nodes ({totalCount})
          </button>

          <button
            type="button"
            onClick={() => onFilterChange('quick_wins')}
            className={`px-3 py-1 rounded-lg transition cursor-pointer flex items-center gap-1 ${
              activeFilter === 'quick_wins'
                ? 'bg-amber-600 text-white font-bold shadow-[0_0_10px_rgba(245,158,11,0.3)]'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Zap className="w-3 h-3 text-amber-300" />
            <span>Quick Wins (S Effort)</span>
          </button>

          <button
            type="button"
            onClick={() => onFilterChange('critical_path')}
            className={`px-3 py-1 rounded-lg transition cursor-pointer flex items-center gap-1 ${
              activeFilter === 'critical_path'
                ? 'bg-rose-600 text-white font-bold shadow-[0_0_10px_rgba(244,63,94,0.3)]'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Flame className="w-3 h-3 text-rose-300" />
            <span>Critical Path</span>
          </button>
        </div>

        <WhyThisOrder />
      </div>
    </div>
  );
};

