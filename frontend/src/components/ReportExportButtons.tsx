import React, { useState } from 'react';
import { ExportFormat, GroundedFinding } from '../types';
import { exportReportFile } from '../api/findingsApi';
import { FileText, FileSpreadsheet, FileCode, Download, Check, Loader2 } from 'lucide-react';

interface ReportExportButtonsProps {
  scanId: string | null;
  findings: GroundedFinding[];
  targetUrl?: string;
  riskScore?: number;
}

export const ReportExportButtons: React.FC<ReportExportButtonsProps> = ({
  scanId,
  findings,
  targetUrl = 'http://localhost:5000',
  riskScore = 38,
}) => {
  const [busyFormat, setBusyFormat] = useState<ExportFormat | null>(null);
  const [doneFormat, setDoneFormat] = useState<ExportFormat | null>(null);

  const handleExport = async (fmt: ExportFormat) => {
    setBusyFormat(fmt);
    try {
      await exportReportFile(scanId, fmt, findings, targetUrl, riskScore);
      setDoneFormat(fmt);
      setTimeout(() => setDoneFormat(null), 2000);
    } finally {
      setBusyFormat(null);
    }
  };

  const buttons: {
    format: ExportFormat;
    label: string;
    sublabel: string;
    icon: React.ReactNode;
    accent: string;
  }[] = [
    {
      format: 'md',
      label: 'Export Markdown',
      sublabel: '.md report',
      icon: <FileText className="w-4 h-4 text-cyan-400" />,
      accent: 'border-cyan-500/40 hover:bg-cyan-500/15 text-cyan-200',
    },
    {
      format: 'pdf',
      label: 'Export PDF',
      sublabel: 'Executive PDF',
      icon: <Download className="w-4 h-4 text-purple-400" />,
      accent: 'border-purple-500/40 hover:bg-purple-500/15 text-purple-200',
    },
    {
      format: 'sarif',
      label: 'Export SARIF',
      sublabel: 'GitHub Code Scanning v2.1',
      icon: <FileCode className="w-4 h-4 text-[#61f5ae]" />,
      accent: 'border-emerald-500/40 hover:bg-emerald-500/15 text-emerald-200',
    },
    {
      format: 'json',
      label: 'Export JSON',
      sublabel: 'Full Machine Artifact',
      icon: <FileSpreadsheet className="w-4 h-4 text-amber-400" />,
      accent: 'border-amber-500/40 hover:bg-amber-500/15 text-amber-200',
    },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2.5">
      {buttons.map((btn) => {
        const isBusy = busyFormat === btn.format;
        const isDone = doneFormat === btn.format;
        return (
          <button
            key={btn.format}
            type="button"
            onClick={() => handleExport(btn.format)}
            disabled={isBusy}
            className={`px-3.5 py-2 rounded-xl bg-slate-950/90 border transition flex items-center gap-2.5 cursor-pointer ${btn.accent}`}
          >
            {isBusy ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : isDone ? (
              <Check className="w-4 h-4 text-[#61f5ae]" />
            ) : (
              btn.icon
            )}
            <div className="text-left">
              <div className="text-xs font-bold font-mono leading-tight">
                {isDone ? 'Exported!' : btn.label}
              </div>
              <div className="text-[10px] text-slate-400 font-mono">{btn.sublabel}</div>
            </div>
          </button>
        );
      })}
    </div>
  );
};

export default ReportExportButtons;

