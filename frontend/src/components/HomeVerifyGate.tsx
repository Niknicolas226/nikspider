import React, { useState } from 'react';
import { Target } from '../types';
import { createTarget, verifyTarget } from '../api/client';
import mascotImage from '../assets/nikspider-mascot.png';
import { Shield, Copy, Check, Loader2, AlertCircle } from 'lucide-react';

interface HomeVerifyGateProps {
  onVerified: (target: Target) => void;
}

export const HomeVerifyGate: React.FC<HomeVerifyGateProps> = ({ onVerified }) => {
  const [url, setUrl] = useState(import.meta.env.VITE_DEMO_TARGET_URL || 'http://localhost:5000');
  const [pendingTarget, setPendingTarget] = useState<Target | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [checking, setChecking] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmitUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = url.trim();
    if (!trimmed) return;

    setSubmitting(true);
    setError(null);
    try {
      const created = await createTarget(trimmed);
      setPendingTarget(created);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to register target');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCheckVerification = async () => {
    if (!pendingTarget) return;
    setChecking(true);
    setError(null);
    try {
      const verified = await verifyTarget(pendingTarget.id);
      if (verified) {
        onVerified({ ...pendingTarget, verified: true });
      } else {
        const cleanUrl = pendingTarget.url.replace(/\/$/, '');
        setError(
          `Ownership proof not detected yet. Ensure ${cleanUrl}/.well-known/nikspider.txt returns exact token "${pendingTarget.token}".`
        );
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Verification check failed');
    } finally {
      setChecking(false);
    }
  };

  const wellKnownUrl = pendingTarget
    ? `${pendingTarget.url.replace(/\/$/, '')}/.well-known/nikspider.txt`
    : '';

  const instructionsBlock = pendingTarget
    ? `# 1. Serve this exact token at:\n${wellKnownUrl}\n\n# 2. File contents:\n${pendingTarget.token}`
    : '';

  const handleCopy = () => {
    if (!pendingTarget) return;
    navigator.clipboard.writeText(pendingTarget.token);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="min-h-screen bg-[#000000] text-white flex flex-col items-center justify-center px-6 py-12 relative overflow-hidden">
      {/* Subtle violet radial atmosphere */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(circle at 50% 35%, rgba(168, 85, 247, 0.18) 0%, rgba(0, 0, 0, 0) 65%)',
        }}
      />

      <div className="relative z-10 w-full max-w-xl space-y-8 text-center">
        {/* 1. Hero: NikSpider mascot/logo + one-line tagline */}
        <div className="space-y-4 flex flex-col items-center">
          <div className="relative w-32 h-32 rounded-2xl overflow-hidden border border-[#a855f7]/60 bg-[#07030d] shadow-[0_0_42px_rgba(168,85,247,0.35)]">
            <img
              src={mascotImage}
              alt="NikSpider Mascot"
              className="w-full h-full object-cover object-center scale-110"
            />
          </div>

          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#07030d] border border-[#a855f7]/45 text-[#c084fc] text-xs font-mono shadow-[0_0_16px_rgba(168,85,247,0.2)]">
            <Shield className="w-3.5 h-3.5 text-[#a855f7]" />
            <span>AI APPSEC PLATFORM</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
            NikSpider
          </h1>
          <p className="text-sm text-zinc-400 max-w-md mx-auto">
            Autonomous Web Security Agent — verify target ownership to unlock the live AppSec Command Center.
          </p>
        </div>

        {/* 2. Single centered input: target URL + 3. "Verify Ownership" button */}
        <form
          onSubmit={handleSubmitUrl}
          className="bg-[#07030d]/90 backdrop-blur-xl border border-[#a855f7]/35 rounded-2xl p-6 shadow-[0_0_36px_rgba(168,85,247,0.16)] space-y-4 text-left"
        >
          <label
            htmlFor="target-url-input"
            className="block text-xs font-mono uppercase tracking-wider text-[#c084fc]"
          >
            Target Application URL
          </label>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              id="target-url-input"
              type="text"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                if (pendingTarget) setPendingTarget(null);
              }}
              placeholder="http://localhost:5000 or https://example.com"
              className="flex-1 bg-[#000000] border border-[#a855f7]/30 focus:border-[#c084fc] focus:shadow-[0_0_16px_rgba(168,85,247,0.3)] rounded-xl px-4 py-3 text-sm font-mono text-white outline-none transition"
              disabled={submitting || checking}
            />
            <button
              type="submit"
              disabled={submitting || !url.trim()}
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-[#a855f7] to-[#9333ea] hover:from-[#c084fc] hover:to-[#a855f7] disabled:opacity-40 text-white font-extrabold text-sm font-mono shadow-[0_0_24px_rgba(168,85,247,0.45)] transition flex items-center justify-center gap-2 cursor-pointer shrink-0"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Generating...</span>
                </>
              ) : (
                <span>Verify Ownership</span>
              )}
            </button>
          </div>
        </form>

        {/* Token + /.well-known/nikspider.txt instructions (shown after POST /api/v2/targets) */}
        {pendingTarget && (
          <div className="bg-[#07030d]/90 backdrop-blur-xl border border-[#a855f7]/45 rounded-2xl p-6 shadow-[0_0_36px_rgba(168,85,247,0.2)] text-left space-y-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-[#c084fc]">
                Ownership Verification Challenge
              </span>
              <button
                type="button"
                onClick={handleCopy}
                className="px-3 py-1 rounded-lg bg-[#000000] hover:bg-purple-500/10 border border-[#a855f7]/35 text-xs font-mono text-[#c084fc] flex items-center gap-1.5 transition cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied Token' : 'Copy Token'}</span>
              </button>
            </div>

            <pre className="p-4 rounded-xl bg-[#000000] border border-[#a855f7]/30 font-mono text-xs text-[#c084fc] overflow-x-auto whitespace-pre-wrap select-all leading-relaxed">
              {instructionsBlock}
            </pre>

            <button
              type="button"
              onClick={handleCheckVerification}
              disabled={checking}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-[#a855f7] to-fuchsia-600 hover:from-[#c084fc] hover:to-fuchsia-500 disabled:opacity-50 text-white font-extrabold text-sm font-mono shadow-[0_0_24px_rgba(168,85,247,0.45)] transition flex items-center justify-center gap-2 cursor-pointer"
            >
              {checking ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Checking /.well-known/nikspider.txt...</span>
                </>
              ) : (
                <span>Check Verification →</span>
              )}
            </button>
          </div>
        )}

        {error && (
          <div className="p-4 rounded-xl bg-[#07030d] border border-red-500/40 text-red-400 text-xs font-mono flex items-start gap-2.5 text-left">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default HomeVerifyGate;
