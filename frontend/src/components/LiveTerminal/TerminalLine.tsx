import React from 'react';
import { TerminalLineItem } from '../../types';

interface TerminalLineProps {
  line: TerminalLineItem;
}

export const TerminalLine: React.FC<TerminalLineProps> = ({ line }) => {
  const getToneStyle = () => {
    switch (line.tone) {
      case 'prompt':
        return {
          prefixColor: 'text-[#61f5ae] font-bold drop-shadow-[0_0_8px_rgba(97,245,174,0.65)]',
          textColor: 'text-[#61f5ae] font-bold tracking-wide',
          rowBg: 'bg-emerald-950/15 border-l-2 border-[#61f5ae]',
        };
      case 'confirmed':
        return {
          prefixColor: 'text-[#61f5ae] font-bold drop-shadow-[0_0_8px_rgba(97,245,174,0.75)]',
          textColor: 'text-[#61f5ae] font-semibold',
          rowBg: 'bg-emerald-500/10 border-l-2 border-emerald-400',
        };
      case 'success':
        return {
          prefixColor: 'text-[#61f5ae]',
          textColor: 'text-emerald-200',
          rowBg: 'hover:bg-slate-900/50 border-l-2 border-transparent',
        };
      case 'warning':
        return {
          prefixColor: 'text-[#ffd45c] font-bold drop-shadow-[0_0_6px_rgba(255,212,92,0.6)]',
          textColor: 'text-[#ffd45c]',
          rowBg: 'bg-amber-500/10 border-l-2 border-amber-400',
        };
      case 'danger':
        return {
          prefixColor: 'text-rose-400',
          textColor: 'text-slate-400 line-through decoration-rose-500/40',
          rowBg: 'hover:bg-slate-900/40 border-l-2 border-transparent opacity-80',
        };
      case 'info':
      default:
        return {
          prefixColor: 'text-cyan-400',
          textColor: 'text-[#d5e4ed]',
          rowBg: 'hover:bg-slate-900/50 border-l-2 border-transparent',
        };
    }
  };

  const styles = getToneStyle();
  const timeShort = line.ts ? new Date(line.ts).toLocaleTimeString([], { hour12: false }) : '';

  const severityBadge = line.severity ? (
    <span
      className={`ml-2 px-1.5 py-0.5 text-[10px] font-mono font-bold uppercase rounded border ${
        line.severity === 'critical' || line.severity === 'high'
          ? 'bg-red-500/20 text-red-300 border-red-500/50 shadow-[0_0_10px_rgba(239,68,68,0.3)]'
          : line.severity === 'medium'
          ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
          : 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
      }`}
    >
      [{line.severity.toUpperCase()}]
    </span>
  ) : null;

  // Strip duplicate leading symbol if message already begins with >, ✓, →, ⚠, ✗
  const cleanText = line.text.replace(/^(>|✓|→|⚠|✗)\s*/, '');

  return (
    <div
      className={`group flex items-start gap-2.5 px-3 py-1.5 rounded-r transition-colors font-mono text-xs leading-relaxed ${styles.rowBg}`}
    >
      <span className="text-[10px] text-slate-600 select-none shrink-0 w-16 pt-0.5">{timeShort}</span>

      <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-900/90 border border-slate-800 text-cyan-400/80 select-none shrink-0">
        S{line.stage}
      </span>

      <span className={`select-none shrink-0 w-4 text-center ${styles.prefixColor}`}>{line.prefix}</span>

      <div className={`flex-1 break-all ${styles.textColor}`}>
        <span>{cleanText}</span>
        {!cleanText.includes('[HIGH]') &&
          !cleanText.includes('[MEDIUM]') &&
          !cleanText.includes('[CRITICAL]') &&
          severityBadge}
      </div>

      {line.module && (
        <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-purple-950/60 border border-purple-500/30 text-purple-300 shrink-0">
          {line.module}
        </span>
      )}
    </div>
  );
};

export default TerminalLine;

