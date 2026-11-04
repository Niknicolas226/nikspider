import React, { useState } from 'react';
import { ScanProfile, Target } from '../types';
import { THEME } from '../styles/theme';
import { Play, Loader2, ShieldCheck, AlertCircle } from 'lucide-react';

interface ScanConfigureStepProps {
  target: Target;
  onStartScan: (profile: ScanProfile) => Promise<void>;
}

export const ScanConfigureStep: React.FC<ScanConfigureStepProps> = ({
  target,
  onStartScan,
}) => {
  const [selectedProfile, setSelectedProfile] = useState<ScanProfile>('standard');
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLaunch = async () => {
    setStarting(true);
    setError(null);
    try {
      await onStartScan(selectedProfile);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to start scan');
      setStarting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto py-10 px-6 space-y-8">
      {/* Verified Target Banner */}
      <div className="bg-[#0a0a0a] border border-[#00d9ff]/30 rounded-2xl p-6 shadow-[0_0_28px_rgba(0,217,255,0.08)] flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 text-xs font-mono text-[#00d9ff]">
            <ShieldCheck className="w-4 h-4" />
            <span>Ownership Verified (/.well-known/nikspider.txt)</span>
          </div>
          <h2 className="text-xl font-extrabold text-white font-mono break-all">
            {target.url}
          </h2>
        </div>

        <span className="px-3 py-1 rounded-full text-xs font-mono bg-[#a855f7]/15 text-[#a855f7] border border-[#a855f7]/40">
          Target ID: {target.id.slice(0, 8)}
        </span>
      </div>

      {/* Profile Selector */}
      <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl p-6 space-y-5">
        <div>
          <h3 className="text-base font-bold text-white">Select Scan Policy Profile</h3>
          <p className="text-xs text-zinc-400 mt-0.5">
            Choose the probe intensity and request budget for this assessment.
          </p>
        </div>

        <div className="space-y-3">
          {THEME.profiles.map((prof) => {
            const isSelected = selectedProfile === prof.id;
            return (
              <button
                key={prof.id}
                type="button"
                onClick={() => setSelectedProfile(prof.id)}
                className={`w-full text-left p-4 rounded-xl border transition-all flex items-center justify-between gap-4 cursor-pointer ${
                  isSelected
                    ? 'bg-[#00d9ff]/10 border-[#00d9ff] shadow-[0_0_22px_rgba(0,217,255,0.2)]'
                    : 'bg-[#000000] border-white/10 hover:border-white/25'
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`w-3 h-3 rounded-full border ${
                        isSelected
                          ? 'bg-[#00d9ff] border-[#00d9ff] shadow-[0_0_10px_#00d9ff]'
                          : 'border-zinc-600'
                      }`}
                    />
                    <span className="text-sm font-bold text-white uppercase font-mono">
                      {prof.label}
                    </span>
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-[#a855f7]/15 text-[#a855f7] border border-[#a855f7]/35">
                      {prof.budget}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400 pl-5">{prof.description}</p>
                </div>
              </button>
            );
          })}
        </div>

        {error && (
          <div className="p-3.5 rounded-xl bg-[#000000] border border-red-500/40 text-red-400 text-xs font-mono flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="pt-2 flex justify-end">
          <button
            type="button"
            onClick={handleLaunch}
            disabled={starting}
            className="px-7 py-3 rounded-xl bg-[#00d9ff] hover:bg-[#00d9ff]/90 disabled:opacity-40 text-black font-extrabold text-sm font-mono shadow-[0_0_26px_rgba(0,217,255,0.45)] transition flex items-center gap-2 cursor-pointer"
          >
            {starting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Initializing Pipeline...</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current" />
                <span>Start Scan</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ScanConfigureStep;

