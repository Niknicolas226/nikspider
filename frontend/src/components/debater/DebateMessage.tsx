import React from 'react';
import { CharacterPersona, CharacterAvatar } from './CharacterAvatar';
import { Quote } from 'lucide-react';

interface DebateMessageProps {
  persona: CharacterPersona;
  speakerName: string;
  roleSubtitle: string;
  timestamp?: string;
  confidence?: number;
  content: string;
  evidenceQuote?: string;
  isEnforcementRule?: boolean;
}

export const DebateMessage: React.FC<DebateMessageProps> = ({
  persona,
  speakerName,
  roleSubtitle,
  timestamp,
  confidence,
  content,
  evidenceQuote,
  isEnforcementRule,
}) => {
  const personaStyles = {
    prosecutor: {
      card: 'bg-red-950/20 border-red-500/30 text-red-100',
      header: 'text-red-400',
      chip: 'bg-red-500/20 text-red-300 border-red-500/40',
      quote: 'bg-red-950/40 border-l-2 border-red-400 text-red-200/90',
    },
    defender: {
      card: 'bg-cyan-950/20 border-cyan-500/30 text-cyan-100',
      header: 'text-cyan-300',
      chip: 'bg-cyan-500/20 text-cyan-200 border-cyan-500/40',
      quote: 'bg-cyan-950/40 border-l-2 border-cyan-400 text-cyan-200/90',
    },
    judge: {
      card: 'bg-purple-950/30 border-purple-500/40 text-purple-100 shadow-[0_0_20px_rgba(168,85,247,0.15)]',
      header: 'text-purple-300',
      chip: 'bg-purple-500/25 text-purple-200 border-purple-400/50',
      quote: 'bg-purple-950/50 border-l-2 border-purple-400 text-purple-200',
    },
    enforcer: {
      card: 'bg-zinc-900/60 border-zinc-600/40 text-zinc-200 font-mono',
      header: 'text-zinc-300',
      chip: 'bg-zinc-800 text-zinc-300 border-zinc-600',
      quote: 'bg-black/60 border-l-2 border-zinc-500 text-zinc-300',
    },
  }[persona];

  return (
    <div className={`p-4 rounded-2xl border ${personaStyles.card} backdrop-blur-md space-y-3 transition-all`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <CharacterAvatar persona={persona} size="sm" />
          <div className="text-left">
            <span className={`text-xs font-bold ${personaStyles.header}`}>{speakerName}</span>
            <span className="text-[11px] text-zinc-400 font-mono ml-2">{roleSubtitle}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {typeof confidence === 'number' && (
            <span
              className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${personaStyles.chip}`}
            >
              Confidence: {Math.round(confidence * (confidence <= 1 ? 100 : 1))}%
            </span>
          )}
          {timestamp && <span className="text-[10px] font-mono text-zinc-500">{timestamp}</span>}
        </div>
      </div>

      {evidenceQuote && (
        <div className={`p-2.5 rounded-xl text-xs font-mono flex items-start gap-2 ${personaStyles.quote}`}>
          <Quote className="w-3.5 h-3.5 shrink-0 opacity-70 mt-0.5" />
          <div className="overflow-x-auto whitespace-pre-wrap break-all">
            <span className="text-[10px] uppercase font-bold tracking-wider opacity-60 block mb-0.5">
              Evidence Citation:
            </span>
            {evidenceQuote}
          </div>
        </div>
      )}

      <p className="text-xs leading-relaxed text-zinc-200 whitespace-pre-wrap">{content}</p>

      {isEnforcementRule && (
        <div className="text-[10px] font-mono px-2.5 py-1 rounded bg-black/60 border border-zinc-700 text-zinc-400 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
          <span>Deterministic safety policy rule enforced. Cannot be overridden by LLM.</span>
        </div>
      )}
    </div>
  );
};

