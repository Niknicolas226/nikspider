import React, { useState } from 'react';
import { RoadmapNode } from '../../types';
import {
  generateMarkdownExport,
  generateCsvExport,
  generateGitHubIssues,
} from '../../utils/roadmapUtils';
import {
  Download,
  FileText,
  FileSpreadsheet,
  FileCode,
  GitPullRequest,
  Printer,
  Check,
} from 'lucide-react';

interface ExportMenuProps {
  nodes: RoadmapNode[];
  riskScore: number;
  targetUrl: string;
}

export const ExportMenu: React.FC<ExportMenuProps> = ({
  nodes,
  riskScore,
  targetUrl,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [copiedAction, setCopiedAction] = useState<string | null>(null);

  const downloadFile = (content: string, filename: string, mime: string) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportMarkdown = () => {
    const md = generateMarkdownExport(nodes, riskScore, targetUrl);
    downloadFile(md, `nikspider-roadmap-${Date.now()}.md`, 'text/markdown');
    setCopiedAction('md');
    setTimeout(() => setCopiedAction(null), 2000);
  };

  const handleExportCsv = () => {
    const csv = generateCsvExport(nodes);
    downloadFile(csv, `nikspider-roadmap-${Date.now()}.csv`, 'text/csv');
    setCopiedAction('csv');
    setTimeout(() => setCopiedAction(null), 2000);
  };

  const handleExportJson = () => {
    const json = JSON.stringify(
      {
        target: targetUrl,
        risk_score: riskScore,
        exported_at: new Date().toISOString(),
        nodes,
      },
      null,
      2
    );
    downloadFile(json, `nikspider-roadmap-${Date.now()}.json`, 'application/json');
    setCopiedAction('json');
    setTimeout(() => setCopiedAction(null), 2000);
  };

  const handleCopyGitHubIssues = () => {
    const ghText = generateGitHubIssues(nodes);
    navigator.clipboard.writeText(ghText);
    setCopiedAction('gh');
    setTimeout(() => setCopiedAction(null), 2000);
  };

  const handlePrintPdf = () => {
    window.print();
  };

  return (
    <div className="relative inline-block text-left">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="px-3.5 py-2 rounded-xl bg-purple-600/30 hover:bg-purple-600/50 border border-purple-400/50 text-white text-xs font-mono font-bold flex items-center gap-2 transition cursor-pointer shadow-[0_0_14px_rgba(168,85,247,0.3)]"
      >
        <Download className="w-3.5 h-3.5 text-purple-300" />
        <span>Export Roadmap</span>
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-[#0e071c] border border-purple-500/40 shadow-[0_0_25px_rgba(168,85,247,0.35)] p-2 z-50 text-left space-y-1 backdrop-blur-2xl animate-in fade-in zoom-in-95 duration-150">
            <button
              type="button"
              onClick={() => {
                handleExportMarkdown();
                setIsOpen(false);
              }}
              className="w-full px-3 py-2 rounded-xl hover:bg-purple-950/50 text-xs font-mono text-zinc-200 hover:text-white flex items-center justify-between transition cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-purple-400" />
                <span>Markdown Checklist</span>
              </div>
              {copiedAction === 'md' && <Check className="w-3.5 h-3.5 text-emerald-400" />}
            </button>

            <button
              type="button"
              onClick={() => {
                handleExportCsv();
                setIsOpen(false);
              }}
              className="w-full px-3 py-2 rounded-xl hover:bg-purple-950/50 text-xs font-mono text-zinc-200 hover:text-white flex items-center justify-between transition cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-cyan-400" />
                <span>CSV (Jira / Linear)</span>
              </div>
              {copiedAction === 'csv' && <Check className="w-3.5 h-3.5 text-emerald-400" />}
            </button>

            <button
              type="button"
              onClick={() => {
                handleExportJson();
                setIsOpen(false);
              }}
              className="w-full px-3 py-2 rounded-xl hover:bg-purple-950/50 text-xs font-mono text-zinc-200 hover:text-white flex items-center justify-between transition cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <FileCode className="w-4 h-4 text-amber-400" />
                <span>JSON Spec</span>
              </div>
              {copiedAction === 'json' && <Check className="w-3.5 h-3.5 text-emerald-400" />}
            </button>

            <button
              type="button"
              onClick={() => {
                handleCopyGitHubIssues();
                setIsOpen(false);
              }}
              className="w-full px-3 py-2 rounded-xl hover:bg-purple-950/50 text-xs font-mono text-zinc-200 hover:text-white flex items-center justify-between transition cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <GitPullRequest className="w-4 h-4 text-white" />
                <span>Copy as GitHub Issues</span>
              </div>
              {copiedAction === 'gh' && <Check className="w-3.5 h-3.5 text-emerald-400" />}
            </button>

            <button
              type="button"
              onClick={() => {
                handlePrintPdf();
                setIsOpen(false);
              }}
              className="w-full px-3 py-2 rounded-xl hover:bg-purple-950/50 text-xs font-mono text-zinc-200 hover:text-white flex items-center justify-between transition cursor-pointer border-t border-zinc-800 pt-2"
            >
              <div className="flex items-center gap-2">
                <Printer className="w-4 h-4 text-purple-300" />
                <span>Print / Save as PDF</span>
              </div>
            </button>
          </div>
        </>
      )}
    </div>
  );
};

