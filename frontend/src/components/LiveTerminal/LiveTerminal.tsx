import React, { useEffect, useRef, useState } from 'react';
import { TerminalLineItem } from '../../types';
import { TerminalLine } from './TerminalLine';
import { Terminal, Play, Trash2, Pause, ArrowDownCircle, Wifi, WifiOff } from 'lucide-react';

interface LiveTerminalProps {
  lines: TerminalLineItem[];
  connected: boolean;
  isComplete: boolean;
  targetUrl?: string;
  onReplay?: () => void;
  onClear?: () => void;
}

export const LiveTerminal: React.FC<LiveTerminalProps> = ({
  lines,
  connected,
  isComplete,
  targetUrl = 'example.com',
  onReplay,
  onClear,
}) => {
  const [filter, setFilter] = useState<'all' | 'probes' | 'signals' | 'confirmed'>('all');
  const [autoScroll, setAutoScroll] = useState(true);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const filteredLines = lines.filter((line) => {
    if (filter === 'probes') return line.prefix === '→';
    if (filter === 'signals') return line.prefix === '⚠';
    if (filter === 'confirmed') return line.tone === 'confirmed';
    return true;
  });

  useEffect(() => {
    if (autoScroll && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [filteredLines.length, autoScroll]);

  return (
    <div className="rounded-2xl overflow-hidden border border-cyan-500/30 bg-[#03060c] shadow-[0_20px_70px_rgba(2,8,23,0.85),0_0_32px_rgba(34,211,238,0.1)]">
      {/* Terminal Top Chrome Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 bg-[#070d19] border-b border-cyan-500/20">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80 shadow-[0_0_6px_rgba(244,63,94,0.6)]" />
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400/80 shadow-[0_0_6px_rgba(251,191,36,0.6)]" />
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400/80 shadow-[0_0_6px_rgba(52,211,153,0.6)]" />
          </div>

          <div className="flex items-center gap-2 text-xs font-mono text-cyan-300">
            <Terminal className="w-3.5 h-3.5 text-[#61f5ae]" />
            <span className="font-bold tracking-wide text-white">nikspider@spidereyes:~</span>
            <span className="text-slate-500">|</span>
            <span className="text-cyan-400/90">{targetUrl}</span>
          </div>
        </div>

        {/* Filter & Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center bg-slate-950/90 p-0.5 rounded-lg border border-slate-800 text-[11px] font-mono">
            {(['all', 'probes', 'signals', 'confirmed'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setFilter(tab)}
                className={`px-2.5 py-1 rounded-md capitalize transition cursor-pointer ${
                  filter === tab
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-semibold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setAutoScroll((prev) => !prev)}
            title="Toggle Auto-Scroll"
            className={`px-2.5 py-1 rounded-lg border text-[11px] font-mono flex items-center gap-1 transition cursor-pointer ${
              autoScroll
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : 'bg-slate-900 border-slate-800 text-slate-400'
            }`}
          >
            {autoScroll ? <ArrowDownCircle className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
            {autoScroll ? 'Follow' : 'Paused'}
          </button>

          {onReplay && (
            <button
              type="button"
              onClick={onReplay}
              className="px-2.5 py-1 rounded-lg bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/40 text-purple-300 text-[11px] font-mono flex items-center gap-1 transition cursor-pointer"
            >
              <Play className="w-3 h-3" /> Replay Stream
            </button>
          )}

          {onClear && (
            <button
              type="button"
              onClick={onClear}
              className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-slate-200 transition cursor-pointer"
              title="Clear terminal"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}

          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono border ${
              connected
                ? 'bg-emerald-500/10 text-[#61f5ae] border-emerald-500/30'
                : 'bg-amber-500/10 text-amber-300 border-amber-500/30'
            }`}
          >
            {connected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
            {connected ? 'WS LIVE' : 'STREAM'}
          </span>
        </div>
      </div>

      {/* Scrolling Terminal Viewport */}
      <div
        ref={containerRef}
        className="h-[440px] overflow-y-auto p-4 space-y-1 font-mono bg-[radial-gradient(ellipse_at_top,rgba(14,165,233,0.06),transparent_70%)]"
      >
        {filteredLines.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-2">
            <Terminal className="w-7 h-7 text-cyan-500/50 animate-pulse" />
            <p className="text-xs font-mono">Waiting for Stage 0→6 WebSocket stream events...</p>
          </div>
        ) : (
          filteredLines.map((line) => <TerminalLine key={line.id} line={line} />)
        )}

        {/* Active blinking prompt cursor matching MascotHero */}
        <div className="flex items-center gap-2 px-3 pt-2 text-xs font-mono text-[#61f5ae]">
          <span>&gt;</span>
          {!isComplete ? (
            <span className="inline-flex items-center gap-2 text-cyan-300/80">
              <span>executing stage pipeline</span>
              <span className="inline-block w-2 h-4 bg-[#61f5ae] animate-pulse shadow-[0_0_8px_#61f5ae]" />
            </span>
          ) : (
            <span className="inline-block w-2 h-4 bg-[#61f5ae] animate-pulse shadow-[0_0_8px_#61f5ae]" />
          )}
        </div>
      </div>
    </div>
  );
};

export default LiveTerminal;

