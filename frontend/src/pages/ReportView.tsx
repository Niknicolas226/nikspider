import React, { useState } from 'react';
import { EvidenceRecord, GroundedFinding, RoadmapNode, RoadmapResponse } from '../types';
import { ReportExportButtons } from '../components/ReportExportButtons';
import { FindingsTable } from '../components/FindingsTable';
import { RoadmapTree } from '../components/RoadmapTree';
import { SummaryBar } from '../components/SummaryBar';
import { EvidenceModal } from '../components/AgentArguments/EvidenceModal';
import { getEvidenceById } from '../api/findingsApi';
import { FileCheck2, GitBranch } from 'lucide-react';

interface ReportViewProps {
  scanId: string | null;
  targetUrl: string;
  findings: GroundedFinding[];
  roadmap: RoadmapResponse | null;
  onSelectRoadmapNode: (node: RoadmapNode) => void;
  onRetestFinding: (finding: GroundedFinding) => Promise<boolean>;
}

export const ReportView: React.FC<ReportViewProps> = ({
  scanId,
  targetUrl,
  findings,
  roadmap,
  onSelectRoadmapNode,
  onRetestFinding,
}) => {
  const [selectedEvidence, setSelectedEvidence] = useState<EvidenceRecord | null>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalTab, setModalTab] = useState<'both' | 'request' | 'response'>('both');

  const highCount = findings.filter((f) => f.severity === 'critical' || f.severity === 'high').length;
  const medCount = findings.filter((f) => f.severity === 'medium').length;
  const riskScore = roadmap?.score ?? (highCount * 15 + medCount * 8);

  const handleOpenEvidence = async (
    evidenceId: string,
    finding: GroundedFinding,
    tab: 'both' | 'request' | 'response' = 'both'
  ) => {
    setModalTab(tab);
    setModalLoading(true);
    try {
      const record = await getEvidenceById(evidenceId, finding);
      setSelectedEvidence(record);
    } finally {
      setModalLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Report Header & Multi-Format Export Bar */}
      <div className="rounded-2xl border border-cyan-500/25 bg-gradient-to-r from-[#070d1c] via-[#0a1326] to-[#081520] p-6 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-mono text-cyan-400">
            <FileCheck2 className="w-4 h-4 text-[#61f5ae]" />
            <span>STAGE 5 &amp; 6 — FINAL ASSESSMENT REPORT &amp; REMEDIATION ROADMAP</span>
          </div>
          <h2 className="text-xl font-extrabold text-white tracking-tight">
            Findings &amp; Executive Export ({targetUrl})
          </h2>
          <p className="text-xs text-slate-400">
            Download machine-readable SARIF v2.1.0 for GitHub Code Scanning, JSON artifacts, or formatted Markdown/PDF executive reports.
          </p>
        </div>

        <ReportExportButtons
          scanId={scanId}
          findings={findings}
          targetUrl={targetUrl}
          riskScore={riskScore}
        />
      </div>

      {/* Summary KPI Bar */}
      {roadmap && (
        <SummaryBar
          roadmap={roadmap}
          onSelectNode={(nodeId) => {
            const found = roadmap.nodes.find((n) => n.id === nodeId);
            if (found) onSelectRoadmapNode(found);
          }}
        />
      )}

      {/* Confirmed Findings Table */}
      <FindingsTable
        findings={findings}
        onOpenEvidence={handleOpenEvidence}
        onRetestFinding={onRetestFinding}
      />

      {/* Root-Cause Repair Roadmap Tree */}
      {roadmap && roadmap.nodes.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-sm font-bold text-white flex items-center gap-2 font-mono">
              <GitBranch className="w-4 h-4 text-cyan-400" />
              Interactive Root-Cause Repair Roadmap (Click any node to generate AI Fix Prompt or Retest)
            </h3>
          </div>
          <RoadmapTree
            nodes={roadmap.nodes}
            onSelectNode={(node) => onSelectRoadmapNode(node)}
          />
        </div>
      )}

      {/* Evidence Modal */}
      {(selectedEvidence || modalLoading) && (
        <EvidenceModal
          evidence={selectedEvidence}
          loading={modalLoading}
          initialTab={modalTab}
          onClose={() => setSelectedEvidence(null)}
        />
      )}
    </div>
  );
};

export default ReportView;

