import React from 'react';
import { GroundedFinding, RoadmapResponse, Target } from '../types';
import { TargetScreen } from '../components/TargetScreen';
import { ScanStepper } from '../components/ScanStepper';
import { MascotAvatar } from '../components/MascotAvatar';
import { Terminal, MessageSquareCode, FileCheck2, Zap, ShieldCheck, AlertTriangle, GitBranch } from 'lucide-react';

interface DashboardProps {
  target: Target | null;
  scanId: string | null;
  isScanning: boolean;
  isComplete: boolean;
  currentStage: number;
  findings: GroundedFinding[];
  roadmap: RoadmapResponse | null;
  onStartScan: (target: Target) => void;
  onStartDemoScan: () => void;
  onNavigate: (page: 'dashboard' | 'scan' | 'arguments' | 'report') => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  target,
  scanId,
  isScanning,
  isComplete,
  currentStage,
  findings,
  roadmap,
  onStartScan,
  onStartDemoScan,
  onNavigate,
}) => {
  const highCount = findings.filter((f) => f.severity === 'critical' || f.severity === 'high').length;
  const medCount = findings.filter((f) => f.severity === 'medium').length;
  const fixedCount = findings.filter((f) => f.status === 'fixed').length;
  const riskScore = roadmap?.score ?? (highCount * 15 + medCount * 8);

  return (
    <div className="space-y-6">
      {/* Top Cyberpunk Banner with Quick Demo Launch & Mascot Status */}
      <div className="rounded-2xl border border-cyan-500/25 bg-gradient-to-r from-[#070d1c] via-[#0b1329] to-[#110c24] p-5 shadow-[0_18px_60px_rgba(2,8,23,0.75)] flex flex-wrap items-center justify-between gap-4">
        <MascotAvatar
          state={isScanning ? 'active' : isComplete || scanId ? 'complete' : 'idle'}
          size="md"
          subtitle={
            target
              ? `Scope locked: ${target.url} (Stage ${currentStage}/6)`
              : 'Autonomous Stage 0→6 AppSec Assessment & Grounded Triage'
          }
        />

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={onStartDemoScan}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-extrabold text-xs font-mono shadow-[0_0_25px_rgba(34,211,238,0.35)] flex items-center gap-2 transition cursor-pointer"
          >
            <Zap className="w-4 h-4" />
            {scanId ? 'Replay Live Demo Scan (Stage 0→6)' : 'Instant Demo Scan (Stage 0→6)'}
          </button>

          <button
            type="button"
            onClick={() => onNavigate('scan')}
            className="px-3.5 py-2.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-cyan-500/30 text-cyan-300 text-xs font-mono font-semibold flex items-center gap-1.5 transition cursor-pointer"
          >
            <Terminal className="w-3.5 h-3.5 text-[#61f5ae]" />
            Live CLI Terminal
          </button>

          <button
            type="button"
            onClick={() => onNavigate('arguments')}
            className="px-3.5 py-2.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-purple-500/35 text-purple-300 text-xs font-mono font-semibold flex items-center gap-1.5 transition cursor-pointer"
          >
            <MessageSquareCode className="w-3.5 h-3.5 text-purple-400" />
            Agent Arguments ({findings.length})
          </button>

          <button
            type="button"
            onClick={() => onNavigate('report')}
            className="px-3.5 py-2.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-emerald-500/35 text-[#61f5ae] text-xs font-mono font-semibold flex items-center gap-1.5 transition cursor-pointer"
          >
            <FileCheck2 className="w-3.5 h-3.5" />
            Findings & Export
          </button>
        </div>
      </div>

      {/* Stage 0→6 Pipeline Progress Stepper */}
      <ScanStepper
        currentStage={currentStage}
        isScanning={isScanning}
        isComplete={isComplete}
        onSelectStage={(stage) => {
          if (stage <= 2) onNavigate('scan');
          else if (stage === 3 || stage === 4) onNavigate('arguments');
          else onNavigate('report');
        }}
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div
          onClick={() => onNavigate('scan')}
          className="rounded-2xl border border-cyan-500/20 bg-[#080d1a]/90 p-4 hover:border-cyan-400/50 transition cursor-pointer"
        >
          <div className="flex items-center justify-between text-xs font-mono text-slate-400">
            <span>PIPELINE STATUS</span>
            <Terminal className="w-4 h-4 text-[#61f5ae]" />
          </div>
          <div className="mt-2 text-2xl font-extrabold text-white font-mono">
            Stage {currentStage} / 6
          </div>
          <p className="text-[11px] text-cyan-300/90 font-mono mt-1">
            {isComplete ? '✓ Full pipeline verified' : isScanning ? '→ Streaming WS probes...' : 'Ready to launch'}
          </p>
        </div>

        <div
          onClick={() => onNavigate('arguments')}
          className="rounded-2xl border border-orange-500/25 bg-[#080d1a]/90 p-4 hover:border-orange-400/50 transition cursor-pointer"
        >
          <div className="flex items-center justify-between text-xs font-mono text-slate-400">
            <span>CONFIRMED FINDINGS</span>
            <AlertTriangle className="w-4 h-4 text-orange-400" />
          </div>
          <div className="mt-2 text-2xl font-extrabold text-white font-mono">
            {findings.length}{' '}
            <span className="text-xs font-normal text-orange-300">
              ({highCount} high, {medCount} medium)
            </span>
          </div>
          <p className="text-[11px] text-purple-300 font-mono mt-1">
            100% grounded to [evidence_id] →
          </p>
        </div>

        <div
          onClick={() => onNavigate('report')}
          className="rounded-2xl border border-purple-500/25 bg-[#080d1a]/90 p-4 hover:border-purple-400/50 transition cursor-pointer"
        >
          <div className="flex items-center justify-between text-xs font-mono text-slate-400">
            <span>COMPOSITE RISK SCORE</span>
            <GitBranch className="w-4 h-4 text-purple-400" />
          </div>
          <div className="mt-2 text-2xl font-extrabold text-white font-mono">
            {riskScore} <span className="text-xs font-normal text-slate-400">/ 100</span>
          </div>
          <p className="text-[11px] text-slate-400 font-mono mt-1">
            Ordered by severity × blast radius
          </p>
        </div>

        <div
          onClick={() => onNavigate('report')}
          className="rounded-2xl border border-emerald-500/25 bg-[#080d1a]/90 p-4 hover:border-emerald-400/50 transition cursor-pointer"
        >
          <div className="flex items-center justify-between text-xs font-mono text-slate-400">
            <span>VERIFIED RETESTS</span>
            <ShieldCheck className="w-4 h-4 text-[#61f5ae]" />
          </div>
          <div className="mt-2 text-2xl font-extrabold text-[#61f5ae] font-mono">
            {fixedCount} / {findings.length}
          </div>
          <p className="text-[11px] text-emerald-300/80 font-mono mt-1">
            Export MD · PDF · SARIF · JSON →
          </p>
        </div>
      </div>

      {/* Ownership-Gated Target Setup */}
      <TargetScreen onScanReady={onStartScan} />
    </div>
  );
};

export default Dashboard;

