import React, { useState } from 'react';
import { TriageResult } from '../../types';
import { computeDebaterSummary } from '../../utils/debaterUtils';
import {
  Sparkles,
  ArrowRight,
  Download,
  CheckCircle2,
  XCircle,
  Clock,
  Check,
} from 'lucide-react';

interface ReportReadyBannerProps {
  findings: TriageResult[];
  rawFlagsCount: number;
  onAdvanceToStep5: () => void;
}

export const ReportReadyBanner: React.FC<ReportReadyBannerProps> = ({
  findings,
  rawFlagsCount,
  onAdvanceToStep5,
}) => {
  const [copiedMd, setCopiedMd] = useState(false);
  const [downloadedCsv, setDownloadedCsv] = useState(false);

  const summary = computeDebaterSummary(findings, rawFlagsCount);

  const handleExportMarkdown = () => {
    let md = `# NikSpider Evidence Triage Summary\n\n`;
    md += `**Total Triaged:** ${findings.length}  \n`;
    md += `**Confirmed:** ${summary.confirmed}  \n`;
    md += `**Rejected (False Positives):** ${summary.rejected}  \n`;
    md += `**Estimated Manual Triage Hours Saved:** ${(summary.estimatedMinutesSaved / 60).toFixed(1)} hrs  \n\n`;
    md += `## Findings Verdict Table\n\n`;
    md += `| Module | URL | Severity | Verdict | Confidence | Reason |\n`;
    md += `| --- | --- | --- | --- | --- | --- |\n`;
    for (const f of findings) {
      md += `| ${f.module || 'probe'} | ${f.url || '/'} | ${f.severity} | ${f.verdict} | ${Math.round((f.confidence ?? 0.85) * 100)}% | ${(f.reason || '').replace(/\|/g, '-')} |\n`;
    }

    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nikspider-triage-summary-${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
    setCopiedMd(true);
    setTimeout(() => setCopiedMd(false), 2000);
  };

  const handleExportCsv = () => {
    const headers = ['ID', 'Module', 'URL', 'Param', 'Severity', 'Verdict', 'Confidence', 'Reason'];
    const rows = findings.map((f) => [
      `"${f.id}"`,
      `"${f.module || ''}"`,
      `"${f.url || ''}"`,
      `"${f.param || ''}"`,
      `"${f.severity}"`,
      `"${f.verdict}"`,
      `"${Math.round((f.confidence ?? 0.85) * 100)}%"`,
      `"${(f.reason || '').replace(/"/g, '""')}"`,
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nikspider-triage-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setDownloadedCsv(true);
    setTimeout(() => setDownloadedCsv(false), 2000);
  };

  return (
    <div className="p-5 rounded-2xl bg-gradient-to-r from-purple-950/70 via-[#13072b]/90 to-purple-950/70 border-2 border-purple-400/60 shadow-[0_0_30px_rgba(168,85,247,0.35)] backdrop-blur-xl flex flex-wrap items-center justify-between gap-4 text-left animate-in fade-in slide-in-from-bottom duration-500">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="p-1.5 rounded-lg bg-purple-600/40 border border-purple-400/60 text-purple-200">
            <Sparkles className="w-5 h-5 text-purple-300" />
          </span>
          <h3 className="text-base font-bold text-white tracking-wide">
            Adversarial Evidence Triage Completed
          </h3>
          <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
            ✓ Report Ready
          </span>
        </div>
        <p className="text-xs text-zinc-300">
          All probe signals adjudicated. Grounded root causes are prepared for remediation.
        </p>

        {/* Stats badges */}
        <div className="flex flex-wrap items-center gap-3 pt-2 font-mono text-xs">
          <span className="flex items-center gap-1.5 text-emerald-300 bg-emerald-950/40 px-2.5 py-1 rounded-lg border border-emerald-500/30">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            Confirmed: <strong>{summary.confirmed}</strong>
          </span>
          <span className="flex items-center gap-1.5 text-red-300 bg-red-950/40 px-2.5 py-1 rounded-lg border border-red-500/30">
            <XCircle className="w-3.5 h-3.5 text-red-400" />
            False Positives Rejected: <strong>{summary.rejected}</strong>
          </span>
          <span className="flex items-center gap-1.5 text-purple-300 bg-purple-950/40 px-2.5 py-1 rounded-lg border border-purple-500/30">
            <Clock className="w-3.5 h-3.5 text-purple-400" />
            Time Saved: <strong>{(summary.estimatedMinutesSaved / 60).toFixed(1)} hrs</strong>
          </span>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="flex items-center gap-1 bg-black/50 p-1 rounded-xl border border-zinc-800">
          <button
            type="button"
            onClick={handleExportMarkdown}
            className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-xs font-mono text-zinc-300 hover:text-white flex items-center gap-1.5 transition cursor-pointer"
            title="Download Markdown summary"
          >
            {copiedMd ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Download className="w-3.5 h-3.5 text-zinc-400" />}
            <span>MD</span>
          </button>
          <button
            type="button"
            onClick={handleExportCsv}
            className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-xs font-mono text-zinc-300 hover:text-white flex items-center gap-1.5 transition cursor-pointer"
            title="Download CSV report"
          >
            {downloadedCsv ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Download className="w-3.5 h-3.5 text-zinc-400" />}
            <span>CSV</span>
          </button>
        </div>

        <button
          type="button"
          onClick={onAdvanceToStep5}
          className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-500 hover:to-fuchsia-500 text-white font-mono font-bold text-xs flex items-center gap-2 shadow-[0_0_20px_rgba(168,85,247,0.5)] transition-all cursor-pointer"
        >
          <span>Advance to Fix Roadmap (Step 5)</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

