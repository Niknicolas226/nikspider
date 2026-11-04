import React from 'react';
import { PlanItem, RawFlag, RequestLogEntry, TerminalLineItem } from '../types';
import { ScanStepper } from '../components/ScanStepper';
import { LiveTerminal } from '../components/LiveTerminal/LiveTerminal';
import { LiveScanFeed } from '../components/LiveScanFeed';
import { MascotAvatar } from '../components/MascotAvatar';
import { MessageSquareCode, FileCheck2 } from 'lucide-react';

interface ScanViewProps {
  targetUrl: string;
  currentStage: number;
  isScanning: boolean;
  isComplete: boolean;
  lines: TerminalLineItem[];
  connected: boolean;
  pagesCrawled: number;
  queueLength: number;
  plan: PlanItem[];
  rawFlags: RawFlag[];
  requestLogs: RequestLogEntry[];
  onReplayStream: () => void;
  onClearTerminal: () => void;
  onNavigate: (page: 'dashboard' | 'scan' | 'arguments' | 'report') => void;
}

export const ScanView: React.FC<ScanViewProps> = ({
  targetUrl,
  currentStage,
  isScanning,
  isComplete,
  lines,
  connected,
  pagesCrawled,
  queueLength,
  plan,
  rawFlags,
  requestLogs,
  onReplayStream,
  onClearTerminal,
  onNavigate,
}) => {
  return (
    <div className="space-y-6">
      {/* Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-[#070c18]/90 border border-cyan-500/20 rounded-2xl p-4">
        <MascotAvatar
          state={isScanning && !isComplete ? 'active' : 'complete'}
          size="sm"
          subtitle={`Streaming real-time Stage 0→6 events from ${targetUrl}`}
        />

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => onNavigate('arguments')}
            className="px-3.5 py-2 rounded-xl bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/40 text-purple-200 text-xs font-mono font-semibold flex items-center gap-1.5 transition cursor-pointer"
          >
            <MessageSquareCode className="w-4 h-4 text-purple-400" />
            Inspect Stage 4 Arguments →
          </button>

          <button
            type="button"
            onClick={() => onNavigate('report')}
            className="px-3.5 py-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-[#61f5ae] text-xs font-mono font-semibold flex items-center gap-1.5 transition cursor-pointer"
          >
            <FileCheck2 className="w-4 h-4" />
            Findings & Report →
          </button>
        </div>
      </div>

      {/* Stage 0→6 Stepper */}
      <ScanStepper
        currentStage={currentStage}
        isScanning={isScanning}
        isComplete={isComplete}
      />

      {/* Primary Hacker CLI Terminal */}
      <LiveTerminal
        lines={lines}
        connected={connected}
        isComplete={isComplete}
        targetUrl={targetUrl}
        onReplay={onReplayStream}
        onClear={onClearTerminal}
      />

      {/* Detailed HTTP Telemetry & Planner Feed */}
      <LiveScanFeed
        pagesCrawled={pagesCrawled || 47}
        queueLength={queueLength}
        plan={plan}
        rawFlags={rawFlags}
        requestLogs={requestLogs}
        isScanning={isScanning}
      />
    </div>
  );
};

export default ScanView;

