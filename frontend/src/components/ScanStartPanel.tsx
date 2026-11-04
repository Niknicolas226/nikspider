import React, { useState } from 'react';
import { ScanProfile } from '../types';
import { useScanStore, scanStore } from '../store/scanStore';
import { startScan } from '../api/client';
import { Play, Loader2, ShieldCheck, AlertCircle, Zap, Shield, Flame } from 'lucide-react';

interface ScanStartPanelProps {
  onScanStarted?: (scanId: string) => void;
}

const POLICY_PROFILES: {
  id: ScanProfile;
  label: string;
  badge: string;
  budget: string;
  description: string;
  modules: string;
  icon: typeof Shield;
}[] = [
  {
    id: 'safe',
    label: 'Safe',
    badge: 'Passive Only',
    budget: '50 requests',
    description: 'Zero-noise passive probes. Inspects headers, cookies, CORS, and exposed paths.',
    modules: '5 passive modules',
    icon: Shield,
  },
  {
    id: 'standard',
    label: 'Standard',
    badge: 'Recommended',
    budget: '500 requests',
    description: 'SPA crawler + all 13 non-destructive modules (SQLi, XSS, Session, Access Controls).',
    modules: '13 non-destructive modules',
    icon: Zap,
  },
  {
    id: 'aggressive',
    label: 'Aggressive',
    badge: 'Full Suite',
    budget: '2000 requests',
    description: 'Exhaustive surface fuzzing, maximum depth, and deep differential confirmation replays.',
    modules: 'Full 13 module suite',
    icon: Flame,
  },
];

export const ScanStartPanel: React.FC<ScanStartPanelProps> = ({ onScanStarted }) => {
  const targetId = useScanStore((s) => s.targetId);
  const targetUrl = useScanStore((s) => s.targetUrl);
  const selectedProfile = useScanStore((s) => s.profile);
  const scanStatus = useScanStore((s) => s.scanStatus);
  const storeError = useScanStore((s) => s.error);

  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const isScanning = scanStatus === 'running' || scanStatus === 'starting';

  const handleLaunchScan = async () => {
    if (!targetId) {
      setLocalError('No verified target available. Complete target verification first.');
      return;
    }

    setLoading(true);
    setLocalError(null);
    scanStore.dispatch({ type: 'START_SCAN_REQUEST' });

    try {
      const scanId = await startScan(targetId, selectedProfile);
      scanStore.dispatch({ type: 'START_SCAN_SUCCESS', payload: { scanId } });
      onScanStarted?.(scanId);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to start scan';
      setLocalError(msg);
      scanStore.dispatch({ type: 'START_SCAN_ERROR', payload: msg });
    } finally {
      setLoading(false);
    }
  };

  const errorMessage = localError || storeError;

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6 animate-stagger-1 text-left">
      {/* ═══════════════════════════════════════════════════════════════════
          VERIFIED TARGET BANNER
      ═══════════════════════════════════════════════════════════════════ */}
      <div className="p-5 rounded-2xl bg-black/80 border border-purple-500/35 shadow-[0_0_24px_rgba(168,85,247,0.18)] flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 text-xs font-mono text-emerald-400">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span className="font-semibold">Target Ownership Verified</span>
            <span className="text-zinc-500">•</span>
            <span className="text-zinc-400">Scope Lock Active</span>
          </div>
          <h2 className="text-xl font-mono font-bold text-white break-all">
            {targetUrl || 'http://localhost:5000'}
          </h2>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-3 py-1 rounded-full text-xs font-mono bg-purple-950/70 text-purple-300 border border-purple-500/40">
            Target ID: {targetId ? targetId.slice(0, 10) : 'n/a'}
          </span>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          POLICY PROFILE RADIO CARDS
      ═══════════════════════════════════════════════════════════════════ */}
      <div className="p-6 rounded-2xl bg-[#090514]/90 border border-purple-500/30 space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              Step 1: Choose Scan Policy Profile
              <span className="text-xs font-mono text-purple-400 font-normal">
                (Request budget enforces non-destructive bounds)
              </span>
            </h3>
            <p className="text-xs text-zinc-400 mt-1">
              Select the execution intensity and maximum probe requests permitted during this assessment.
            </p>
          </div>

          {isScanning && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono bg-purple-500/15 border border-purple-400 text-purple-300 animate-pulse">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Scan Active — Profile Locked</span>
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
          {POLICY_PROFILES.map((prof) => {
            const isSelected = selectedProfile === prof.id;
            const Icon = prof.icon;

            return (
              <label
                key={prof.id}
                className={`relative p-4 rounded-xl border text-left transition-all duration-200 flex flex-col justify-between ${
                  isScanning
                    ? 'opacity-50 cursor-not-allowed'
                    : 'cursor-pointer'
                } ${
                  isSelected
                    ? 'bg-purple-600/25 border-purple-400 shadow-[0_0_24px_rgba(168,85,247,0.3)] ring-1 ring-purple-400'
                    : 'bg-black/60 border-purple-500/20 hover:border-purple-500/50 text-zinc-400'
                }`}
              >
                <input
                  type="radio"
                  name="scan-profile"
                  value={prof.id}
                  disabled={isScanning}
                  checked={isSelected}
                  onChange={() => scanStore.dispatch({ type: 'SET_PROFILE', payload: prof.id })}
                  className="sr-only"
                />

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                          isSelected
                            ? 'bg-purple-500/30 text-purple-200'
                            : 'bg-zinc-800 text-zinc-400'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                      </div>
                      <span className="font-mono font-bold text-sm text-white uppercase">
                        {prof.label}
                      </span>
                    </div>

                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                        isSelected
                          ? 'bg-purple-950 text-purple-300 border-purple-400'
                          : 'bg-zinc-900 text-zinc-500 border-zinc-800'
                      }`}
                    >
                      {prof.badge}
                    </span>
                  </div>

                  <div className="text-xs font-mono font-semibold text-purple-300">
                    Budget: {prof.budget}
                  </div>

                  <p className="text-xs text-zinc-300 font-sans leading-relaxed">
                    {prof.description}
                  </p>
                </div>

                <div className="mt-3 pt-2.5 border-t border-purple-500/20 flex items-center justify-between text-[11px] font-mono text-zinc-400">
                  <span>{prof.modules}</span>
                  <span className={isSelected ? 'text-purple-300 font-bold' : 'text-zinc-600'}>
                    {isSelected ? '● Selected' : '○ Select'}
                  </span>
                </div>
              </label>
            );
          })}
        </div>

        {/* ═══════════════════════════════════════════════════════════════════
            INLINE ERROR BANNER (4xx, SSRF, GUARD)
        ═══════════════════════════════════════════════════════════════════ */}
        {errorMessage && (
          <div
            role="alert"
            aria-live="polite"
            className="p-4 rounded-xl bg-[#14041a] border border-red-500/60 text-red-300 text-xs font-mono flex items-start gap-3 shadow-[0_0_24px_rgba(239,68,68,0.25)]"
          >
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-bold text-red-200">Scan Launch Error:</span>
              <p className="leading-relaxed">{errorMessage}</p>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            START BUTTON ROW
        ═══════════════════════════════════════════════════════════════════ */}
        <div className="pt-3 flex flex-wrap items-center justify-between gap-4 border-t border-purple-500/20">
          <div className="text-xs font-mono text-zinc-400">
            Autonomous assessment will crawl surface, execute non-destructive probes, and compile fix roadmap.
          </div>

          <button
            type="button"
            disabled={isScanning || loading || !targetId}
            onClick={handleLaunchScan}
            className="px-8 py-3.5 rounded-xl bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-500 hover:to-fuchsia-500 disabled:opacity-40 text-white font-mono font-bold text-sm flex items-center gap-2.5 transition shadow-[0_0_25px_rgba(168,85,247,0.5)] cursor-pointer"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Initializing Orchestrator...</span>
              </>
            ) : isScanning ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-purple-200" />
                <span>Scan In Progress...</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-white" />
                <span>Start Security Scan ({selectedProfile.toUpperCase()}) →</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

