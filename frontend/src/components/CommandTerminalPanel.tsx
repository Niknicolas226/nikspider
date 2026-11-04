import React, { useState, useRef, useEffect } from 'react';
import { Terminal, Send, Minus, Square, X } from 'lucide-react';
import { TriageResult } from '../types';

export interface TerminalLogLine {
  id: string;
  tag: 'SYSTEM' | 'INFO' | 'WARN' | 'FLAG' | 'CMD' | 'ERROR';
  text: string;
  ts: string;
}

interface CommandTerminalPanelProps {
  logs: TerminalLogLine[];
  onClearLogs: () => void;
  onAppendLog: (tag: TerminalLogLine['tag'], text: string) => void;
  onStartScan: (profile: 'safe' | 'standard' | 'aggressive') => Promise<void>;
  onRetestFinding: (findingId: string) => Promise<void>;
  scanStatus: string;
  scanStage: number;
  findings: TriageResult[];
  expanded?: boolean;
}

export const CommandTerminalPanel: React.FC<CommandTerminalPanelProps> = ({
  logs,
  onClearLogs,
  onAppendLog,
  onStartScan,
  onRetestFinding,
  scanStatus,
  scanStage,
  findings,
  expanded = false,
}) => {
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  const getTagColor = (tag: TerminalLogLine['tag']) => {
    switch (tag) {
      case 'SYSTEM':
        return 'text-purple-400';
      case 'INFO':
        return 'text-emerald-400';
      case 'WARN':
        return 'text-amber-400';
      case 'FLAG':
        return 'text-red-400';
      case 'CMD':
        return 'text-cyan-300';
      case 'ERROR':
        return 'text-rose-400';
    }
  };

  const handleExecute = async (e: React.FormEvent) => {
    e.preventDefault();
    const raw = input.trim();
    if (!raw || busy) return;
    setInput('');
    onAppendLog('CMD', `> ${raw}`);

    const normalized = raw.toLowerCase().replace(/\s+/g, ' ');

    if (normalized === 'clear') {
      onClearLogs();
      return;
    }

    if (normalized === 'help') {
      onAppendLog(
        'INFO',
        'Whitelisted commands: scan start --profile=safe|standard|aggressive | scan status | findings list [--severity=critical|high|medium|low] | retest <finding_id> | clear'
      );
      return;
    }

    if (normalized === 'scan status') {
      const confirmed = findings.filter((f) => f.verdict === 'confirmed').length;
      onAppendLog(
        'INFO',
        `Scan status: ${scanStatus.toUpperCase()} (Stage ${scanStage}/6) · Confirmed findings: ${confirmed}`
      );
      return;
    }

    const startMatch = normalized.match(/^scan start(?:\s+--profile=(safe|standard|aggressive))?$/);
    if (startMatch) {
      const prof = (startMatch[1] || 'standard') as 'safe' | 'standard' | 'aggressive';
      setBusy(true);
      onAppendLog('SYSTEM', `Dispatching POST /api/v2/scans with profile=${prof}...`);
      try {
        await onStartScan(prof);
      } catch (err: unknown) {
        onAppendLog('ERROR', err instanceof Error ? err.message : 'Failed to start scan.');
      } finally {
        setBusy(false);
      }
      return;
    }

    const findingsMatch = normalized.match(
      /^findings list(?:\s+--severity=(critical|high|medium|low))?$/
    );
    if (findingsMatch) {
      const sevFilter = findingsMatch[1]?.toUpperCase();
      const confirmedList = findings.filter(
        (f) =>
          f.verdict === 'confirmed' &&
          (!sevFilter || (f.severity || '').toUpperCase() === sevFilter)
      );
      if (confirmedList.length === 0) {
        onAppendLog(
          'INFO',
          sevFilter
            ? `No confirmed findings matching severity=${sevFilter}.`
            : 'No confirmed findings recorded yet.'
        );
      } else {
        confirmedList.slice(0, 8).forEach((f) => {
          onAppendLog(
            'FLAG',
            `[${f.severity || 'Medium'}] ${f.module || 'Finding'} (${f.url || '/'}) — id=${f.id}`
          );
        });
      }
      return;
    }

    const retestMatch = raw.trim().match(/^retest\s+([A-Za-z0-9_-]+)$/i);
    if (retestMatch) {
      const fid = retestMatch[1];
      setBusy(true);
      onAppendLog('SYSTEM', `Triggering retest for finding ${fid}...`);
      try {
        await onRetestFinding(fid);
        onAppendLog('INFO', `Retest completed for finding ${fid}.`);
      } catch (err: unknown) {
        onAppendLog('ERROR', err instanceof Error ? err.message : `Retest failed for ${fid}.`);
      } finally {
        setBusy(false);
      }
      return;
    }

    onAppendLog(
      'ERROR',
      `Command rejected by policy gate: "${raw}". Type "help" for allowed commands.`
    );
  };

  return (
    <div
      className="rounded-2xl border border-purple-500/35 bg-[#07030d]/90 backdrop-blur-xl flex flex-col overflow-hidden"
      style={{
        boxShadow: '0 0 28px rgba(168, 85, 247, 0.14), inset 0 1px 0 rgba(192, 132, 252, 0.12)',
      }}
    >
      {/* Header */}
      <div className="px-4 py-2.5 border-b border-purple-500/20 flex items-center justify-between bg-purple-950/20">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-purple-400" />
          <span className="text-sm font-semibold text-white tracking-tight">
            Command Terminal
          </span>
        </div>
        <div className="flex items-center gap-2 text-zinc-500">
          <Minus className="w-3.5 h-3.5 hover:text-zinc-300 cursor-pointer" />
          <Square className="w-3 h-3 hover:text-zinc-300 cursor-pointer" />
          <button
            type="button"
            onClick={onClearLogs}
            title="Clear terminal logs"
            className="hover:text-red-400 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Log Output */}
      <div
        ref={scrollRef}
        className={`p-3.5 font-mono text-xs space-y-1.5 overflow-y-auto ${
          expanded ? 'h-[360px]' : 'h-[128px]'
        } bg-black/50`}
      >
        {logs.map((line) => (
          <div key={line.id} className="leading-relaxed break-all">
            <span className={`font-semibold ${getTagColor(line.tag)}`}>
              [{line.tag}]
            </span>{' '}
            <span className="text-zinc-200">{line.text}</span>
          </div>
        ))}
      </div>

      {/* Command Input Bar */}
      <form
        onSubmit={handleExecute}
        className="p-2.5 border-t border-purple-500/20 bg-[#050209] flex items-center gap-2"
      >
        <div className="flex-1 flex items-center gap-2 bg-black/80 border border-purple-500/30 rounded-lg px-3 py-1.5 focus-within:border-purple-400 transition">
          <span className="text-purple-400 font-mono text-xs font-bold select-none">
            &gt;_
          </span>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Enter command... (e.g. scan start --profile=standard)"
            className="w-full bg-transparent text-xs font-mono text-white placeholder-zinc-500 focus:outline-none"
          />
        </div>
        <button
          type="submit"
          disabled={busy}
          className="px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-purple-600/80 to-fuchsia-600/80 hover:from-purple-500 hover:to-fuchsia-500 border border-purple-400/50 text-xs font-mono font-bold text-white tracking-wider flex items-center gap-1.5 shadow-[0_0_15px_rgba(168,85,247,0.4)] transition cursor-pointer disabled:opacity-50"
        >
          EXECUTE
          <Send className="w-3 h-3" />
        </button>
      </form>
    </div>
  );
};
