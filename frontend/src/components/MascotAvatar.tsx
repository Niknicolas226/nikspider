import React from 'react';
import mascotImage from '../assets/nikspider-mascot.png';

interface MascotAvatarProps {
  state?: 'idle' | 'active' | 'complete';
  size?: 'sm' | 'md' | 'lg';
  subtitle?: string;
}

export const MascotAvatar: React.FC<MascotAvatarProps> = ({
  state = 'idle',
  size = 'md',
  subtitle,
}) => {
  const dimensions =
    size === 'sm' ? 'w-11 h-11' : size === 'lg' ? 'w-20 h-20' : 'w-14 h-14';

  const statusConfig =
    state === 'active'
      ? {
          ring: 'border-cyan-400 shadow-[0_0_22px_rgba(34,211,238,0.55)]',
          dot: 'bg-cyan-400 animate-ping',
          label: 'SPIDER-AGENT PROBING',
          text: 'text-cyan-300',
        }
      : state === 'complete'
      ? {
          ring: 'border-[#61f5ae] shadow-[0_0_20px_rgba(97,245,174,0.45)]',
          dot: 'bg-[#61f5ae]',
          label: 'TRIAGE VERIFIED',
          text: 'text-[#61f5ae]',
        }
      : {
          ring: 'border-purple-500/50 shadow-[0_0_16px_rgba(168,85,247,0.3)]',
          dot: 'bg-purple-400',
          label: 'GUARD STANDBY',
          text: 'text-purple-300',
        };

  return (
    <div className="inline-flex items-center gap-3">
      <div className={`relative rounded-xl overflow-hidden border-2 bg-black shrink-0 ${dimensions} ${statusConfig.ring}`}>
        <img
          src={mascotImage}
          alt="NikSpider Autonomous Cyber Mascot"
          className="w-full h-full object-cover object-center scale-110"
        />
        <span className={`absolute bottom-1 right-1 w-2.5 h-2.5 rounded-full ${statusConfig.dot}`} />
      </div>

      <div className="flex flex-col">
        <div className="flex items-center gap-1.5">
          <span className={`text-[10px] font-mono font-bold uppercase tracking-wider ${statusConfig.text}`}>
            {statusConfig.label}
          </span>
        </div>
        {subtitle && <span className="text-xs text-slate-400 font-mono">{subtitle}</span>}
      </div>
    </div>
  );
};

export default MascotAvatar;

