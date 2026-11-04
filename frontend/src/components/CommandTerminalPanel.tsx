import React, { useState, useRef, useEffect } from 'react';
import { Terminal, Send, Minus, Square, X, Trash2 } from 'lucide-react';
import { useScanStore, scanStore, TerminalLogLine } from '../store/scanStore';
import { StepId, STEPS } from '../config/steps';
import { startScan, retestFindingDetailed } from '../api/client';
import { ScanProfile } from '../types';

interface CommandTerminalPanelProps {
  expanded?: boolean;
  onToggleExpand?: () => void;
  onClose?: () => void;
}

export const CommandTerminalPanel: React.FC<CommandTerminalPanelProps> = ({
  expanded = false,
  onToggleExpand,
  onClose,
}) => {
  const terminalLogs = useScanStore((s) => s.terminalLogs);
  const scanStatus = useScanStore((s) => s.scanStatus);
  const currentStep = useScanStore((s) => s.currentStep);
  const furthestStep = useScanStore((s) => s.furthestStep);
  const profile = useScanStore((s) => s.profile);
  const targetId = useScanStore((s) => s.targetId);
  const kpis = useScanStore((s) => s.kpis);

  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [terminalLogs]);

  const append = (tag: TerminalLogLine['tag'], text: string) => {
    scanStore.dispatch({ type: 'APPEND_TERMINAL_LOG', payload: { tag, text } });
  };

  const handleExecuteCommand = async (cmdString: string) => {
    const raw = cmdString.trim();
    if (!raw) return;
    setInput('');
    append('CMD', `> ${raw}`);

    const parts = raw.split(/\s+/);
    const command = parts[0]?.toLowerCase();
    const sub = parts[1]?.toLowerCase();

    // 1. CLEAR
    if (command === 'clear' || command === 'cls') {
      scanStore.dispatch({ type: 'CLEAR_TERMINAL_LOGS' });
      append('SYSTEM', 'Terminal buffer cleared.');
      return;
    }

    // 2. HELP
    if (command === 'help') {
      append('INFO', 'Supported NikSpider CLI Commands:');
      append('INFO', '  scan start [--profile=safe|standard|aggressive]  : Launch autonomous scan');
      append('INFO', '  scan status                                     : Display pipeline state & KPIs');
      append('INFO', '  step <1..6>                                     : Jump to an unlocked step');
      append('INFO', '  retest <finding_id>                             : Execute 1-click live retest');
      append('INFO', '  report                                          : Navigate to Step 5 report exporters');
      append('INFO', '  clear                                           : Clear terminal buffer');
      return;
    }

    // 3. SCAN COMMANDS
    if (command === 'scan') {
      if (sub === 'start') {
        let chosenProfile: ScanProfile = profile;
        const profileArg = parts.find((p) => p.startsWith('--profile='));
        if (profileArg) {
          const val = profileArg.split('=')[1]?.toLowerCase();
          if (val === 'safe' || val === 'standard' || val === 'aggressive') {
            chosenProfile = val;
            scanStore.dispatch({ type: 'SET_PROFILE', payload: val });
          }
        }

        if (!targetId) {
          append('ERROR', 'No verified target present. Verify ownership on Step 1 first.');
          return;
        }

        setBusy(true);
        scanStore.dispatch({ type: 'START_SCAN_REQUEST' });
        try {
          const scanId = await startScan(targetId, chosenProfile);
          scanStore.dispatch({ type: 'START_SCAN_SUCCESS', payload: { scanId } });
          append('SYSTEM', `Scan started successfully with ID: ${scanId}`);
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'Scan start failed';
          scanStore.dispatch({ type: 'START_SCAN_ERROR', payload: msg });
          append('ERROR', `Error starting scan: ${msg}`);
        } finally {
          setBusy(false);
        }
        return;
      }

      if (sub === 'status') {
        append('INFO', `Scan Status: ${scanStatus.toUpperCase()}`);
        append('INFO', `Current Step: ${currentStep} (${STEPS[currentStep - 1]?.shortLabel})`);
        append('INFO', `Furthest Step: ${furthestStep} | Profile: ${profile.toUpperCase()}`);
        append(
          'INFO',
          `KPIs: Score: ${kpis.riskScore ?? '--'} | Confirmed: ${kpis.confirmed} | High Sev: ${kpis.highSeverity} | Endpoints: ${kpis.endpoints}`
        );
        return;
      }

      append('WARN', 'Unknown scan subcommand. Try: "scan start" or "scan status"');
      return;
    }

    // 4. STEP COMMAND
    if (command === 'step') {
      const targetStep = parseInt(sub || '', 10) as StepId;
      if (targetStep >= 1 && targetStep <= 6) {
        if (targetStep > furthestStep && scanStore.getState().steps[targetStep] === 'locked') {
          append('WARN', `Cannot jump to Step ${targetStep}. Complete step ${targetStep - 1} first.`);
        } else {
          scanStore.dispatch({ type: 'GO_TO_STEP', payload: targetStep });
          append('SYSTEM', `Navigated to Step ${targetStep}: ${STEPS[targetStep - 1].name}`);
        }
        return;
      }
      append('WARN', 'Usage: step <1..6>');
      return;
    }

    // 5. RETEST COMMAND
    if (command === 'retest') {
      const findingId = parts[1];
      if (!findingId) {
        append('WARN', 'Usage: retest <finding_id>');
        return;
      }

      setBusy(true);
      append('INFO', `Initiating live probe retest for finding ${findingId}...`);
      try {
        const res = await retestFindingDetailed(findingId);
        scanStore.dispatch({
          type: 'RETEST_RESULT',
          payload: {
            findingId,
            passed: res.passed,
            status: res.status,
            message: res.message,
            score: res.score,
          },
        });
        append(
          res.passed ? 'INFO' : 'WARN',
          `Retest result: ${res.status.toUpperCase()}. ${res.message}`
        );
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Retest failed';
        append('ERROR', `Retest error: ${msg}`);
      } finally {
        setBusy(false);
      }
      return;
    }

    // 6. REPORT COMMAND
    if (command === 'report') {
      if (furthestStep >= 5) {
        scanStore.dispatch({ type: 'GO_TO_STEP', payload: 5 });
        append('SYSTEM', 'Navigated to Step 5: Fix Roadmap & Report Exporters.');
      } else {
        append('WARN', 'Report is generated at Step 5. Complete Steps 1-4 first.');
      }
      return;
    }

    // UNKNOWN COMMAND
    append('WARN', `Unknown command "${command}". Type "help" to see available commands.`);
  };

  const getTagColor = (tag: TerminalLogLine['tag']) => {
    switch (tag) {
      case 'SYSTEM':
        return 'text-purple-400 font-bold';
      case 'INFO':
        return 'text-emerald-400';
      case 'WARN':
        return 'text-amber-400';
      case 'FLAG':
        return 'text-rose-400 font-bold';
      case 'CMD':
        return 'text-cyan-300 font-bold';
      case 'ERROR':
        return 'text-red-400 font-bold';
    }
  };

  return (
    <div className="flex flex-col h-full rounded-2xl bg-black/90 border border-purple-500/35 overflow-hidden shadow-[0_0_30px_rgba(168,85,247,0.18)]">
      {/* ═══════════════════════════════════════════════════════════════════
          HEADER BAR
      ═══════════════════════════════════════════════════════════════════ */}
      <div className="p-3 border-b border-purple-500/25 bg-[#090514] flex items-center justify-between text-xs font-mono">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-purple-400" />
          <span className="font-bold text-white tracking-wide">Command Terminal</span>
          <span className="text-[10px] text-purple-400/80 bg-purple-950/70 border border-purple-500/30 px-2 py-0.5 rounded">
            Interactive CLI
          </span>
        </div>

        <div className="flex items-center gap-2 text-zinc-400">
          <button
            type="button"
            onClick={() => scanStore.dispatch({ type: 'CLEAR_TERMINAL_LOGS' })}
            className="hover:text-white p-1 cursor-pointer transition"
            title="Clear buffer"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          {onToggleExpand && (
            <button
              type="button"
              onClick={onToggleExpand}
              className="hover:text-white p-1 cursor-pointer transition"
              title={expanded ? 'Minimize' : 'Maximize'}
            >
              <Square className="w-3.5 h-3.5" />
            </button>
          )}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="hover:text-white p-1 cursor-pointer transition"
              title="Close panel"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          OUTPUT LOG STREAM
      ═══════════════════════════════════════════════════════════════════ */}
      <div
        ref={scrollRef}
        className="flex-1 p-4 font-mono text-xs overflow-y-auto space-y-1 select-text bg-[#030206] text-zinc-300"
        style={{ minHeight: expanded ? '420px' : '220px' }}
      >
        {terminalLogs.map((log) => (
          <div key={log.id} className="leading-relaxed flex items-start gap-2 break-all">
            <span className="text-zinc-600 text-[10px] shrink-0 select-none">{log.ts}</span>
            <span className={`shrink-0 ${getTagColor(log.tag)}`}>[{log.tag}]</span>
            <span className="text-zinc-200">{log.text}</span>
          </div>
        ))}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          COMMAND INPUT PROMPT
      ═══════════════════════════════════════════════════════════════════ */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleExecuteCommand(input);
        }}
        className="p-3 border-t border-purple-500/25 bg-[#090514] flex items-center gap-2 text-xs font-mono"
      >
        <span className="text-purple-400 font-bold select-none">&gt;</span>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Enter command (e.g. scan start, scan status, step 3, help)..."
          disabled={busy}
          className="flex-1 bg-transparent text-white placeholder-zinc-500 outline-none font-mono"
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          className="px-3.5 py-1.5 rounded-lg bg-purple-600/30 hover:bg-purple-600/50 border border-purple-400/50 text-white font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-40 transition"
        >
          <Send className="w-3 h-3" />
          <span>Execute</span>
        </button>
      </form>
    </div>
  );
};
