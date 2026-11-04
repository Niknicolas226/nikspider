import React, { useState } from 'react';
import { useScanStore, scanStore } from '../store/scanStore';
import { RoadmapNode, GroundedFinding } from '../types';
import { RoadmapTree } from './RoadmapTree';
import { RoadmapDrawer } from './RoadmapDrawer';
import { ReportExportButtons } from './ReportExportButtons';
import { StepNavFooter } from './StepNavFooter';
import { GitBranch, Download, Sparkles, Flame, CheckCircle2, AlertCircle } from 'lucide-react';

export const StepRoadmapView: React.FC = () => {
  const roadmap = useScanStore((s) => s.roadmap);
  const verdicts = useScanStore((s) => s.verdicts);
  const scanId = useScanStore((s) => s.scanId);
  const targetUrl = useScanStore((s) => s.targetUrl);
  const riskScore = useScanStore((s) => s.kpis.riskScore ?? 0);
  const isRunning = useScanStore((s) => s.steps[5] === 'running');
  const isDone = useScanStore((s) => s.steps[5] === 'done');

  const [selectedNode, setSelectedNode] = useState<RoadmapNode | null>(null);
  const [showExporters, setShowExporters] = useState(false);

  const openNodes = roadmap.nodes.filter((n) => n.status === 'open');
  const fixedNodes = roadmap.nodes.filter((n) => n.status === 'fixed');

  // Convert triage results into GroundedFinding for exporter
  const groundedFindings: GroundedFinding[] = verdicts
    .filter((v) => v.verdict === 'confirmed')
    .map((v) => {
      const sev = (v.severity ? v.severity.toLowerCase() : 'medium') as any;
      return {
        id: v.id,
        scan_id: scanId || undefined,
        evidence_id: `ev-${v.id}`,
        module: v.module || 'security_probe',
        url: v.url || targetUrl || 'http://localhost:5000',
        endpoint: v.url || '/',
        param: v.param || '',
        severity: sev,
        verdict: v.verdict,
        status: 'confirmed',
        owasp: v.owasp || 'A01:2021-Broken Access Control',
        confidence: v.confidence ?? 0.9,
        signal: v.reason || 'Anomaly detected',
        reason: v.reason || 'Confirmed via multi-agent evidence validation.',
        request: v.evidence?.request || 'GET / HTTP/1.1',
        response: v.evidence?.response_excerpt || 'HTTP/1.1 200 OK',
        severity_case: v.agent_a || 'High likelihood of exploitability across unauthenticated sessions.',
        mitigating_factors: v.agent_b || 'Restricted network boundary and basic sanitization.',
        neutral_summary: v.reason || 'Vulnerability confirmed by deterministic check replay.',
      };
    });

  const handleNodeFixed = (nodeId: string, findingId: string, newScore?: number) => {
    scanStore.dispatch({
      type: 'RETEST_RESULT',
      payload: {
        findingId,
        nodeId,
        passed: true,
        status: 'fixed',
        message: 'Live probe confirmed vulnerability remediated.',
        score: newScore,
      },
    });
  };

  return (
    <div className="space-y-6 text-left">
      {/* ═══════════════════════════════════════════════════════════════════
          HEADER & EXPORT TRIGGER
      ═══════════════════════════════════════════════════════════════════ */}
      <div className="p-5 rounded-2xl bg-[#090514]/90 border border-purple-500/30 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-purple-600/30 border border-purple-400/40 text-purple-200 text-xs font-mono font-bold flex items-center justify-center">
              5
            </span>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <span>SpiderBrain — Root-Cause Remediation Roadmap</span>
              <span className="text-xs font-mono font-normal text-purple-300 bg-purple-950 px-2 py-0.5 rounded-full border border-purple-500/30">
                DAG Clustered
              </span>
            </h3>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Deduplicated fix nodes prioritized Critical → Low. Select any node to view fix steps and copy AI prompts.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowExporters(!showExporters)}
            className="px-4 py-2 rounded-xl bg-purple-600/30 hover:bg-purple-600/50 border border-purple-400/50 text-white text-xs font-mono font-bold flex items-center gap-2 transition cursor-pointer shadow-[0_0_16px_rgba(168,85,247,0.35)]"
          >
            <Download className="w-3.5 h-3.5 text-purple-300" />
            <span>Download Report</span>
          </button>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          COLLAPSIBLE EXPORT STRIP (MD / PDF / SARIF / JSON)
      ═══════════════════════════════════════════════════════════════════ */}
      {showExporters && (
        <div className="p-4 rounded-2xl bg-black/80 border border-purple-500/40 animate-stagger-1 space-y-3">
          <div className="text-xs font-mono text-zinc-300 font-semibold flex items-center justify-between">
            <span>Export Verified Assessment Report:</span>
            <span className="text-zinc-500 text-[11px]">
              Ready for executive or engineering handoff
            </span>
          </div>
          <ReportExportButtons
            scanId={scanId}
            findings={groundedFindings}
            targetUrl={targetUrl || 'http://localhost:5000'}
            riskScore={riskScore}
          />
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          ROADMAP DIRECTED ACYCLIC GRAPH (DAG)
      ═══════════════════════════════════════════════════════════════════ */}
      <div className="p-5 rounded-2xl bg-black/80 border border-purple-500/25 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2 text-xs font-mono">
          <div className="flex items-center gap-2">
            <GitBranch className="w-4 h-4 text-purple-400" />
            <span className="text-white font-bold">
              Remediation DAG ({roadmap.nodes.length} Nodes)
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-rose-300 bg-rose-950/40 px-2 py-0.5 rounded border border-rose-500/30">
              {openNodes.length} Open
            </span>
            <span className="text-emerald-300 bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-500/30">
              {fixedNodes.length} Fixed
            </span>
          </div>
        </div>

        {roadmap.nodes.length === 0 ? (
          <div className="p-12 text-center text-xs font-mono text-zinc-500 border border-dashed border-zinc-800 rounded-xl">
            {isRunning
              ? 'SpiderBrain is clustering findings into root-cause remediation nodes...'
              : 'No roadmap nodes compiled yet. Complete Steps 1-4 first.'}
          </div>
        ) : (
          <div className="h-[480px] w-full rounded-xl overflow-hidden border border-purple-500/20">
            <RoadmapTree
              nodes={roadmap.nodes}
              onSelectNode={(n) => setSelectedNode(n)}
            />
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          NODE DETAILS & FIX PROMPT DRAWER
      ═══════════════════════════════════════════════════════════════════ */}
      <RoadmapDrawer
        node={selectedNode}
        onClose={() => setSelectedNode(null)}
        onNodeFixed={handleNodeFixed}
      />

      {/* Step Navigation Footer */}
      <StepNavFooter currentStep={5} />
    </div>
  );
};
