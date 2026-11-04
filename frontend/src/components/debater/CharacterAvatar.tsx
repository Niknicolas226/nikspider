import React from 'react';
import { Flame, Shield, Scale, Terminal } from 'lucide-react';

export type CharacterPersona = 'prosecutor' | 'defender' | 'judge' | 'enforcer';

interface CharacterAvatarProps {
  persona: CharacterPersona;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

export const CharacterAvatar: React.FC<CharacterAvatarProps> = ({
  persona,
  size = 'md',
  showLabel = false,
}) => {
  const configs = {
    prosecutor: {
      name: 'Agent A — The Prosecutor',
      shortName: 'Prosecutor',
      role: 'Offensive AppSec Agent',
      icon: Flame,
      bg: 'bg-gradient-to-br from-red-600/30 to-amber-600/20',
      border: 'border-red-500/50',
      text: 'text-red-400',
      glow: 'shadow-[0_0_14px_rgba(239,68,68,0.35)]',
    },
    defender: {
      name: 'Agent B — The Defender',
      shortName: 'Defender',
      role: 'Defensive Mitigation Agent',
      icon: Shield,
      bg: 'bg-gradient-to-br from-cyan-600/30 to-teal-600/20',
      border: 'border-cyan-400/50',
      text: 'text-cyan-300',
      glow: 'shadow-[0_0_14px_rgba(6,182,212,0.35)]',
    },
    judge: {
      name: 'The Judge — Consensus Model',
      shortName: 'The Judge',
      role: 'Deterministic Arbiter',
      icon: Scale,
      bg: 'bg-gradient-to-br from-purple-600/40 to-fuchsia-600/30',
      border: 'border-purple-400/60',
      text: 'text-purple-300',
      glow: 'shadow-[0_0_18px_rgba(168,85,247,0.45)]',
    },
    enforcer: {
      name: 'Rule Engine Enforcer',
      shortName: 'Rule Enforcer',
      role: 'Deterministic Guardrail',
      icon: Terminal,
      bg: 'bg-zinc-800/80',
      border: 'border-zinc-500/50',
      text: 'text-zinc-300',
      glow: 'shadow-[0_0_10px_rgba(161,161,170,0.25)]',
    },
  };

  const cfg = configs[persona];
  const Icon = cfg.icon;

  const sizeClasses = {
    sm: 'w-7 h-7 text-xs',
    md: 'w-9 h-9 text-sm',
    lg: 'w-11 h-11 text-base',
  }[size];

  const iconSizes = {
    sm: 'w-3.5 h-3.5',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  }[size];

  return (
    <div className="flex items-center gap-2">
      <div
        className={`${sizeClasses} rounded-xl ${cfg.bg} border ${cfg.border} ${cfg.text} ${cfg.glow} flex items-center justify-center shrink-0 transition-transform`}
      >
        <Icon className={iconSizes} />
      </div>
      {showLabel && (
        <div className="text-left">
          <div className={`text-xs font-bold ${cfg.text}`}>{cfg.name}</div>
          <div className="text-[10px] text-zinc-400 font-mono">{cfg.role}</div>
        </div>
      )}
    </div>
  );
};

