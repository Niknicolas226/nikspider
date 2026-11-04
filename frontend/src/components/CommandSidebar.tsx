import React from 'react';
import { StepId, STEPS } from '../config/steps';
import { useScanStore, scanStore } from '../store/scanStore';
import {
  Terminal,
  Activity,
  Settings,
  HelpCircle,
  CheckCircle2,
  Loader2,
  Lock,
  Flame,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import mascotImage from '../assets/nikspider-mascot.png';

export type ToolSection = 'terminal' | 'activity_logs' | 'settings' | 'help_docs';

interface CommandSidebarProps {
  activeTool: ToolSection | null;
  onSelectTool: (tool: ToolSection) => void;
  onSelectStep: (stepId: StepId) => void;
}

export const CommandSidebar: React.FC<CommandSidebarProps> = ({
  activeTool,
  onSelectTool,
  onSelectStep,
}) => {
  const currentStep = useScanStore((s) => s.currentStep);
  const furthestStep = useScanStore((s) => s.furthestStep);
  const stepsState = useScanStore((s) => s.steps);
  const targetUrl = useScanStore((s) => s.targetUrl);

  const handleStepClick = (stepId: StepId) => {
    const status = stepsState[stepId];
    if (status === 'locked' && stepId > furthestStep) return;
    onSelectStep(stepId);
  };

  return (
    <aside
      className="w-64 bg-black/85 border-r border-purple-500/25 p-4 flex flex-col justify-between shrink-0 select-none overflow-y-auto"
      aria-label="NikSpider Main Navigation"
    >
      <div className="space-y-6">
        {/* ═══════════════════════════════════════════════════════════════════
            BRAND LOGO
        ═══════════════════════════════════════════════════════════════════ */}
        <div className="flex items-center gap-3 px-2">
          <div className="w-9 h-9 rounded-xl bg-[#0e0720] border border-purple-500/50 flex items-center justify-center shadow-[0_0_16px_rgba(168,85,247,0.4)] overflow-hidden shrink-0">
            <img
              src={mascotImage}
              alt="NikSpider Mascot"
              className="w-full h-full object-cover scale-125"
            />
          </div>
          <div>
            <div className="text-base font-cyber font-bold tracking-tight">
              <span className="text-white">Nik</span>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-fuchsia-400 to-purple-500">
                Spider
              </span>
            </div>
            <div className="text-[10px] font-mono text-purple-400/80 uppercase tracking-wider">
              AI AppSec Platform
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════
            THE 6 GUIDED STEPS
        ═══════════════════════════════════════════════════════════════════ */}
        <div className="space-y-1.5">
          <div className="px-2 text-[10px] font-mono uppercase tracking-wider text-purple-400/70 font-semibold mb-2">
            6-Step Workflow
          </div>

          {STEPS.map((step) => {
            const status = stepsState[step.id];
            const isCurrent = activeTool === null && step.id === currentStep;
            const isLocked = status === 'locked' && step.id > furthestStep;
            const isDone = status === 'done';
            const isRunning = status === 'running';

            let badgeClass = 'bg-zinc-800 text-zinc-500';
            let itemClass = 'text-zinc-500 opacity-60 cursor-not-allowed';

            if (isCurrent) {
              badgeClass = 'bg-purple-500 text-white font-bold shadow-[0_0_10px_rgba(168,85,247,0.7)]';
              itemClass =
                'bg-purple-600/25 border border-purple-400/60 text-white font-semibold shadow-[0_0_16px_rgba(168,85,247,0.25)]';
            } else if (isDone) {
              badgeClass = 'bg-emerald-500 text-black font-bold';
              itemClass = 'text-emerald-200 hover:bg-emerald-950/30 hover:text-white cursor-pointer';
            } else if (isRunning) {
              badgeClass = 'bg-purple-600 text-white animate-pulse';
              itemClass = 'text-purple-200 bg-purple-950/40 hover:bg-purple-900/40 cursor-pointer';
            } else if (!isLocked) {
              badgeClass = 'bg-zinc-700 text-zinc-200';
              itemClass = 'text-zinc-300 hover:bg-purple-950/20 hover:text-white cursor-pointer';
            }

            return (
              <button
                key={step.id}
                type="button"
                disabled={isLocked}
                aria-disabled={isLocked}
                aria-current={isCurrent ? 'step' : undefined}
                title={isLocked ? `Complete step ${step.id - 1} first` : `View Step ${step.id}: ${step.name}`}
                onClick={() => handleStepClick(step.id)}
                className={`w-full p-2.5 rounded-xl text-left text-xs font-mono flex items-center justify-between transition focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 ${itemClass}`}
              >
                <div className="flex items-center gap-2.5 truncate">
                  <span
                    className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] shrink-0 ${badgeClass}`}
                  >
                    {step.id}
                  </span>
                  <span className="truncate">{step.name}</span>
                </div>

                <div className="shrink-0">
                  {isDone && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                  {isRunning && <Loader2 className="w-3.5 h-3.5 text-purple-300 animate-spin" />}
                  {isLocked && <Lock className="w-3 h-3 text-zinc-600" />}
                </div>
              </button>
            );
          })}
        </div>

        {/* ═══════════════════════════════════════════════════════════════════
            TOOLS GROUP
        ═══════════════════════════════════════════════════════════════════ */}
        <div className="space-y-1 pt-2 border-t border-purple-500/20">
          <div className="px-2 text-[10px] font-mono uppercase tracking-wider text-purple-400/70 font-semibold mb-2">
            Tools
          </div>

          <button
            type="button"
            onClick={() => onSelectTool('terminal')}
            className={`w-full p-2.5 rounded-xl text-left text-xs font-mono flex items-center gap-2.5 transition cursor-pointer ${
              activeTool === 'terminal'
                ? 'bg-purple-600/25 border border-purple-400 text-white'
                : 'text-zinc-400 hover:bg-purple-950/20 hover:text-white'
            }`}
          >
            <Terminal className="w-4 h-4 text-purple-400" />
            <span>Command Terminal</span>
          </button>

          <button
            type="button"
            onClick={() => onSelectTool('activity_logs')}
            className={`w-full p-2.5 rounded-xl text-left text-xs font-mono flex items-center gap-2.5 transition cursor-pointer ${
              activeTool === 'activity_logs'
                ? 'bg-purple-600/25 border border-purple-400 text-white'
                : 'text-zinc-400 hover:bg-purple-950/20 hover:text-white'
            }`}
          >
            <Activity className="w-4 h-4 text-purple-400" />
            <span>Activity Logs</span>
          </button>

          <button
            type="button"
            onClick={() => onSelectTool('settings')}
            className={`w-full p-2.5 rounded-xl text-left text-xs font-mono flex items-center gap-2.5 transition cursor-pointer ${
              activeTool === 'settings'
                ? 'bg-purple-600/25 border border-purple-400 text-white'
                : 'text-zinc-400 hover:bg-purple-950/20 hover:text-white'
            }`}
          >
            <Settings className="w-4 h-4 text-purple-400" />
            <span>Settings</span>
          </button>

          <button
            type="button"
            onClick={() => onSelectTool('help_docs')}
            className={`w-full p-2.5 rounded-xl text-left text-xs font-mono flex items-center gap-2.5 transition cursor-pointer ${
              activeTool === 'help_docs'
                ? 'bg-purple-600/25 border border-purple-400 text-white'
                : 'text-zinc-400 hover:bg-purple-950/20 hover:text-white'
            }`}
          >
            <HelpCircle className="w-4 h-4 text-purple-400" />
            <span>Help & Docs</span>
          </button>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          ACTIVE TARGET CARD (FOOTER OF SIDEBAR)
      ═══════════════════════════════════════════════════════════════════ */}
      <div className="pt-4 border-t border-purple-500/20 text-left space-y-1">
        <div className="text-[10px] font-mono uppercase text-zinc-500 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span>Active Target</span>
        </div>
        <div className="text-xs font-mono text-zinc-200 font-semibold truncate">
          {targetUrl || 'localhost:5000'}
        </div>
        <div className="text-[10px] font-mono text-purple-400">
          Scope Locked
        </div>
      </div>
    </aside>
  );
};

