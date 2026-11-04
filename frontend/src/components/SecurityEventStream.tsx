import React, { useEffect, useState } from 'react';
import { Zap } from 'lucide-react';

export interface SecurityStreamItem {
  id: string;
  text: string;
  tone: 'purple' | 'emerald' | 'amber' | 'red';
  createdAtMs: number;
}

interface SecurityEventStreamProps {
  events: SecurityStreamItem[];
}

function formatRelativeTime(createdAtMs: number, nowMs: number): string {
  const diffSec = Math.max(0, Math.floor((nowMs - createdAtMs) / 1000));
  if (diffSec < 2) return 'Just now';
  if (diffSec < 60) return `${diffSec}s ago`;
  const mins = Math.floor(diffSec / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ago`;
}

export const SecurityEventStream: React.FC<SecurityEventStreamProps> = ({ events }) => {
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const getNodeClasses = (tone: SecurityStreamItem['tone']) => {
    switch (tone) {
      case 'emerald':
        return {
          ring: 'border-emerald-400/70 bg-emerald-500/20 shadow-[0_0_10px_rgba(34,197,94,0.5)]',
          dot: 'bg-emerald-400',
          text: 'text-emerald-400 font-medium',
        };
      case 'amber':
        return {
          ring: 'border-amber-400/70 bg-amber-500/20 shadow-[0_0_10px_rgba(245,158,11,0.5)]',
          dot: 'bg-amber-400',
          text: 'text-amber-300',
        };
      case 'red':
        return {
          ring: 'border-red-400/70 bg-red-500/20 shadow-[0_0_10px_rgba(239,68,68,0.5)]',
          dot: 'bg-red-400',
          text: 'text-red-300 font-medium',
        };
      default:
        return {
          ring: 'border-purple-400/70 bg-purple-500/20 shadow-[0_0_10px_rgba(168,85,247,0.5)]',
          dot: 'bg-purple-300',
          text: 'text-zinc-200',
        };
    }
  };

  return (
    <div
      className="rounded-2xl border border-purple-500/35 bg-[#07030d]/90 backdrop-blur-xl p-4 flex flex-col justify-between h-full"
      style={{
        boxShadow: '0 0 28px rgba(168, 85, 247, 0.14), inset 0 1px 0 rgba(192, 132, 252, 0.12)',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-purple-400" />
          <span className="text-sm font-semibold text-white tracking-tight">
            Security Event Stream
          </span>
        </div>
        <span className="text-xs font-mono font-medium text-emerald-400">
          Live Feed
        </span>
      </div>

      {/* Timeline list */}
      <div className="relative flex-1 overflow-y-auto max-h-[215px] pr-1 space-y-3">
        {events.length === 0 ? (
          <div className="py-10 text-center text-xs font-mono text-zinc-500">
            Waiting for live security stream events...
          </div>
        ) : (
          events.slice(0, 8).map((ev, idx) => {
            const style = getNodeClasses(ev.tone);
            return (
              <div
                key={ev.id}
                className="relative flex items-center justify-between gap-3 text-xs"
              >
                {idx < Math.min(events.length, 8) - 1 && (
                  <div className="absolute left-[9px] top-5 bottom-[-14px] w-px bg-purple-500/25" />
                )}
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${style.ring}`}
                  >
                    <span className={`w-2 h-2 rounded-full ${style.dot}`} />
                  </div>
                  <span className={`truncate ${style.text}`}>{ev.text}</span>
                </div>
                <span className="text-[11px] font-mono text-zinc-400 shrink-0">
                  {formatRelativeTime(ev.createdAtMs, nowMs)}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

