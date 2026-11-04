import React, { useState } from 'react';
import { Target } from '../types';
import { createTarget, verifyTarget } from '../api/client';
import { MascotHero } from './MascotHero';
import { Shield, ShieldAlert, CheckCircle2, Lock, ArrowRight, Loader2, Copy, Check } from 'lucide-react';

interface TargetScreenProps {
  onScanReady: (target: Target) => void;
}

export const TargetScreen: React.FC<TargetScreenProps> = ({ onScanReady }) => {
  const [url, setUrl] = useState(import.meta.env.VITE_DEMO_TARGET_URL || 'http://localhost:5000');
  const [target, setTarget] = useState<Target | null>(null);
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleRegisterTarget = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    setLoading(true);
    setError(null);
    try {
      const created = await createTarget(url.trim());
      setTarget(created);
    } catch (err: any) {
      setError(err.message || 'Failed to initialize target');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!target) return;
    setVerifying(true);
    setError(null);
    try {
      const verified = await verifyTarget(target.id);
      if (verified) {
        setTarget({ ...target, verified: true });
      } else {
        setError(`Verification failed. Verification file at ${target.url}/.well-known/nikspider.txt must return "${target.token}".`);
      }
    } catch (err: any) {
      setError(err.message || 'Verification check error');
    } finally {
      setVerifying(false);
    }
  };

  const copyToken = () => {
    if (!target) return;
    navigator.clipboard.writeText(target.token);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const targetHost = target?.url ? new URL(target.url).host : null;
  const bundledDemo = target?.url.startsWith('http://demo-app:5000');

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <MascotHero />
      {/* Intro Hero */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 backdrop-blur">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-cyan-500/10 border border-cyan-500/30 rounded-lg text-cyan-400">
            <Shield className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">Ownership-Gated Target Setup</h2>
            <p className="text-sm text-slate-400 mt-1">
              NikSpider adheres to strict zero-unauthorized-scan policies. You must prove ownership of the domain
              before non-destructive probes are unlocked.
            </p>
          </div>
        </div>

        {/* Input Form */}
        <form onSubmit={handleRegisterTarget} className="mt-6 flex gap-3">
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://your-domain.com or http://localhost:5000"
            className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-500 transition font-mono"
            disabled={loading || (target !== null && target.verified)}
          />
          <button
            type="submit"
            disabled={loading || !url.trim() || (target !== null && target.verified)}
            className="px-5 py-2.5 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition flex items-center gap-2 cursor-pointer"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Register Target'}
          </button>
        </form>

        {error && (
          <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-300 text-xs flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* Verification Instructions Box */}
      {target && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-cyan-400">Step 2: Prove Ownership</span>
              {targetHost && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700">
                  <Lock className="w-3 h-3 text-cyan-400" />
                  Scope locked to {targetHost}
                </span>
              )}
            </div>

            {target.verified ? (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 rounded-full">
                <CheckCircle2 className="w-4 h-4" /> Domain Verified
              </span>
            ) : (
              <span className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/30 px-2.5 py-0.5 rounded-full">
                Verification Pending
              </span>
            )}
          </div>

          <div className="bg-slate-950 p-4 rounded-lg border border-slate-800/80 space-y-2">
            <p className="text-xs text-slate-400">
              {bundledDemo
                ? 'The bundled demo target is already configured with this token. Its verification endpoint is:'
                : 'Serve a plain text file containing this token at:'}
            </p>
            <div className="font-mono text-xs text-cyan-300 bg-slate-900 p-2 rounded border border-slate-800 select-all">
              {target.url.replace(/\/$/, '')}/.well-known/nikspider.txt
            </div>

            <div className="pt-2 flex items-center justify-between">
              <div className="font-mono text-xs text-white bg-slate-900 px-3 py-2 rounded border border-slate-800 flex-1 mr-2 select-all overflow-hidden text-ellipsis">
                {target.token}
              </div>
              <button
                type="button"
                onClick={copyToken}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded border border-slate-700 flex items-center gap-1.5 cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={handleVerify}
              disabled={verifying || target.verified}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white text-xs font-medium rounded-lg border border-slate-700 transition flex items-center gap-2 cursor-pointer"
            >
              {verifying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
              Verify Ownership
            </button>

            <button
              type="button"
              onClick={() => onScanReady(target)}
              disabled={!target.verified}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:hover:bg-emerald-600 text-white text-xs font-semibold rounded-lg shadow-lg shadow-emerald-950 transition flex items-center gap-2 cursor-pointer ml-auto"
            >
              Start Security Scan
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

