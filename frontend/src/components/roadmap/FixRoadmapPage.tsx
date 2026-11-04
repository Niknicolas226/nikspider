import React, { useState } from 'react';
import { useScanStore, scanStore } from '../../store/scanStore';
import { RoadmapNode, GroundedFinding } from '../../types';
import { RoadmapHero } from './RoadmapHero';
import { StartHereCard } from './StartHereCard';
import { RoadmapChecklist } from './RoadmapChecklist';
import { RoadmapBoard } from './RoadmapBoard';
import { RoadmapTree } from '../RoadmapTree';
import { NodeDetail } from './NodeDetail';
import { PromptBridge } from './PromptBridge';
import { ExportMenu } from './ExportMenu';
import {
  RoadmapFilter,
  filterRoadmapNodes,
  sortRoadmapNodes,
  calculateProjectedScore,
} from '../../utils/roadmapUtils';
import { retestFindingDetailed } from '../../api/client';
import {
  ListChecks,
  GitBranch,
  Kanban,
  ArrowLeft,
  ArrowRight,
  RotateCcw,
  Sparkles,
  Layers,
} from 'lucide-react';

export const FixRoadmapPage: React.FC = () => {
  const roadmap = useScanStore((s) => s.roadmap);
  const verdicts = useScanStore((s) => s.verdicts);
  const scanId = useScanStore((s) => s.scanId);
  const targetUrl = useScanStore((s) => s.targetUrl);
  const riskScore = useScanStore((s) => s.kpis.riskScore ?? 0);
  const steps = useScanStore((s) => s.steps);

  const [viewMode, setViewMode] = useState<'checklist' | 'graph' | 'board'>('checklist');
  const [activeFilter, setActiveFilter] = useState<RoadmapFilter>('all');
  const [selectedNode, setSelectedNode] = useState<RoadmapNode | null>(null);
  const [promptNode, setPromptNode] = useState<RoadmapNode | null>(null);
  const [hoveredNode, setHoveredNode] = useState<RoadmapNode | null>(null);
  const [retestingNodeId, setRetestingNodeId] = useState<string | null>(null);
  const [isRetestingAllFixed, setIsRetestingAllFixed] = useState(false);

  // Derive initial scan score from raw count or max
  const initialScore = Math.max(riskScore, roadmap.score || 0);

  // Projected score when hovering a node
  const projectedScore = hoveredNode
    ? calculateProjectedScore(riskScore, hoveredNode)
    : null;

  // Filtered nodes
  const filteredNodes = filterRoadmapNodes(roadmap.nodes, activeFilter);
  const sortedNodes = sortRoadmapNodes(filteredNodes, 'priority');

  // Handle single node retest
  const handleRetestNode = async (node: RoadmapNode) => {
    const findingId = node.finding_ids?.[0];
    if (!findingId) return;

    setRetestingNodeId(node.id);
    try {
      const res = await retestFindingDetailed(findingId);
      scanStore.dispatch({
        type: 'RETEST_RESULT',
        payload: {
          findingId,
          nodeId: node.id,
          passed: res.passed,
          status: res.status,
          message: res.message,
          score: res.score,
        },
      });
    } catch (err) {
      scanStore.dispatch({
        type: 'RETEST_RESULT',
        payload: {
          findingId,
          nodeId: node.id,
          passed: false,
          status: 'error',
          message: err instanceof Error ? err.message : 'Retest failed',
        },
      });
    } finally {
      setRetestingNodeId(null);
    }
  };

  // Handle Retest All Fixed
  const handleRetestAllFixed = async () => {
    const fixed = roadmap.nodes.filter((n) => n.status === 'fixed');
    if (fixed.length === 0) return;

    setIsRetestingAllFixed(true);
    for (const node of fixed) {
      const fid = node.finding_ids?.[0];
      if (fid) {
        try {
          const res = await retestFindingDetailed(fid);
          scanStore.dispatch({
            type: 'RETEST_RESULT',
            payload: {
              findingId: fid,
              nodeId: node.id,
              passed: res.passed,
              status: res.status,
              message: res.message,
              score: res.score,
            },
          });
        } catch {}
      }
    }
    setIsRetestingAllFixed(false);
  };

  const handleJumpToDebate = (findingId: string) => {
    scanStore.dispatch({ type: 'GO_TO_STEP', payload: 4 });
  };

  const handleBackToStep4 = () => {
    scanStore.dispatch({ type: 'GO_TO_STEP', payload: 4 });
  };

  const handleNextToStep6 = () => {
    scanStore.dispatch({ type: 'UNLOCK_STEP', payload: 6 });
    scanStore.dispatch({ type: 'GO_TO_STEP', payload: 6 });
  };

  return (
    <div className="space-y-6 text-left">
      {/* ═══════════════════════════════════════════════════════════════════
          PAGE TOP BAR: STEP 5 OF 6 & BACK / NEXT
      ═══════════════════════════════════════════════════════════════════ */}
      <div className="p-4 rounded-2xl bg-[#090514]/90 border border-purple-500/30 flex flex-wrap items-center justify-between gap-4 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-purple-600/30 border border-purple-400/50 text-purple-200 text-sm font-mono font-bold flex items-center justify-center shadow-[0_0_12px_rgba(168,85,247,0.3)]">
            5
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-white tracking-wide">
                Fix Roadmap — SpiderBrain Remediation
              </h2>
              <span className="text-xs font-mono text-purple-300 bg-purple-950 px-2 py-0.5 rounded-full border border-purple-500/30">
                Step 5 of 6
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">
              Root-cause clustered fix plan prioritized by attack surface impact. Verify fixes with 1-click live probes.
            </p>
          </div>
        </div>

        {/* Back / Next buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleBackToStep4}
            className="px-3.5 py-2 rounded-xl bg-black/60 hover:bg-zinc-800 border border-zinc-700 text-xs font-mono text-zinc-300 hover:text-white flex items-center gap-1.5 transition cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Debater (Step 4)</span>
          </button>

          <button
            type="button"
            onClick={handleNextToStep6}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-500 hover:to-fuchsia-500 text-xs font-mono font-bold text-white flex items-center gap-1.5 transition cursor-pointer shadow-[0_0_16px_rgba(168,85,247,0.3)]"
          >
            <span>Next: Retest & Verify (Step 6)</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          HERO & PROGRESS HEADER
      ═══════════════════════════════════════════════════════════════════ */}
      <RoadmapHero
        nodes={roadmap.nodes}
        initialScore={initialScore}
        currentScore={riskScore}
        projectedScore={projectedScore}
        activeFilter={activeFilter}
        onFilterChange={setActiveFilter}
      />

      {/* ═══════════════════════════════════════════════════════════════════
          START HERE RECOMMENDATION CARD
      ═══════════════════════════════════════════════════════════════════ */}
      <StartHereCard
        nodes={roadmap.nodes}
        onSelectNode={setSelectedNode}
        onRetestNode={handleRetestNode}
        onOpenPromptBridge={setPromptNode}
        retestingNodeId={retestingNodeId}
      />

      {/* ═══════════════════════════════════════════════════════════════════
          VIEW SWITCHER & ACTIONS BAR
      ═══════════════════════════════════════════════════════════════════ */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-3 rounded-2xl bg-[#090514]/80 border border-purple-500/20">
        {/* 3 View Mode Tabs */}
        <div className="flex items-center gap-1 bg-black/60 p-1 rounded-xl border border-zinc-800 text-xs font-mono">
          <button
            type="button"
            onClick={() => setViewMode('checklist')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition cursor-pointer ${
              viewMode === 'checklist'
                ? 'bg-purple-600 text-white font-bold shadow-[0_0_12px_rgba(168,85,247,0.3)]'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <ListChecks className="w-3.5 h-3.5 text-purple-300" />
            <span>Checklist View</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('graph')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition cursor-pointer ${
              viewMode === 'graph'
                ? 'bg-purple-600 text-white font-bold shadow-[0_0_12px_rgba(168,85,247,0.3)]'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <GitBranch className="w-3.5 h-3.5 text-cyan-300" />
            <span>DAG Tree View</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('board')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition cursor-pointer ${
              viewMode === 'board'
                ? 'bg-purple-600 text-white font-bold shadow-[0_0_12px_rgba(168,85,247,0.3)]'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Kanban className="w-3.5 h-3.5 text-amber-300" />
            <span>Kanban Board</span>
          </button>
        </div>

        {/* Action buttons: Retest All Fixed & Export Menu */}
        <div className="flex items-center gap-2">
          {roadmap.nodes.some((n) => n.status === 'fixed') && (
            <button
              type="button"
              onClick={handleRetestAllFixed}
              disabled={isRetestingAllFixed}
              className="px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-xs font-mono text-zinc-200 hover:text-white flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${isRetestingAllFixed ? 'animate-spin' : ''}`} />
              <span>{isRetestingAllFixed ? 'Re-probing All...' : 'Retest All Fixed'}</span>
            </button>
          )}

          <ExportMenu
            nodes={roadmap.nodes}
            riskScore={riskScore}
            targetUrl={targetUrl || 'http://localhost:5000'}
          />
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          ACTIVE VIEW RENDERING
      ═══════════════════════════════════════════════════════════════════ */}
      {roadmap.nodes.length === 0 ? (
        <div className="p-16 text-center text-xs font-mono text-zinc-500 border border-dashed border-zinc-800 rounded-2xl bg-black/60 space-y-2">
          <p className="text-sm font-semibold text-zinc-300">
            No roadmap nodes generated yet.
          </p>
          <p className="text-xs text-zinc-500">
            Complete the Stage 4 Adversarial Triage Debate to construct the DAG remediation roadmap.
          </p>
        </div>
      ) : (
        <div>
          {viewMode === 'checklist' && (
            <RoadmapChecklist
              nodes={sortedNodes}
              onSelectNode={setSelectedNode}
              onRetestNode={handleRetestNode}
              onOpenPromptBridge={setPromptNode}
              onHoverNode={setHoveredNode}
              retestingNodeId={retestingNodeId}
            />
          )}

          {viewMode === 'graph' && (
            <div className="rounded-2xl border border-purple-500/30 overflow-hidden bg-black/80">
              <RoadmapTree
                nodes={roadmap.nodes}
                onSelectNode={(node) => setSelectedNode(node)}
              />
            </div>
          )}

          {viewMode === 'board' && (
            <RoadmapBoard
              nodes={sortedNodes}
              onSelectNode={setSelectedNode}
              onRetestNode={handleRetestNode}
              onOpenPromptBridge={setPromptNode}
              onHoverNode={setHoveredNode}
              retestingNodeId={retestingNodeId}
            />
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          SLIDE-OVER NODE DETAIL DRAWER
      ═══════════════════════════════════════════════════════════════════ */}
      <NodeDetail
        node={selectedNode}
        onClose={() => setSelectedNode(null)}
        onRetest={handleRetestNode}
        onOpenPromptBridge={(node) => {
          setSelectedNode(null);
          setPromptNode(node);
        }}
        onJumpToDebate={handleJumpToDebate}
        isRetesting={selectedNode ? retestingNodeId === selectedNode.id : false}
      />

      {/* ═══════════════════════════════════════════════════════════════════
          AI PROMPT BRIDGE MODAL
      ═══════════════════════════════════════════════════════════════════ */}
      <PromptBridge
        node={promptNode}
        isOpen={Boolean(promptNode)}
        onClose={() => setPromptNode(null)}
      />
    </div>
  );
};

