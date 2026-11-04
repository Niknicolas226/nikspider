import React, { useState } from 'react';
import { Target } from '../types';
import { createTarget, verifyTarget } from '../api/client';
import mascotImage from '../assets/nikspider-mascot.png';
import {
  Shield,
  ShieldCheck,
  Link2,
  Globe,
  Lock,
  Zap,
  Rocket,
  Copy,
  Check,
  Loader2,
  AlertCircle,
  Home,
  Sun,
  ExternalLink,
} from 'lucide-react';
import './HomeVerifyGate.css';

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
  const [highGlow, setHighGlow] = useState(true);

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
    <div
      className={`min-h-screen bg-[#000000] text-white flex flex-col justify-between relative overflow-hidden select-none sm:select-auto ${
        highGlow ? '' : 'opacity-95'
      }`}
    >
      {/* ═══════════════════════════════════════════════════════════════════
          BACKGROUND CYBERPUNK GEOMETRY & SILHOUETTE
      ═══════════════════════════════════════════════════════════════════ */}
      {/* Central Ambient Radial Glow */}
      <div
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          background:
            'radial-gradient(circle at 50% 32%, rgba(168, 85, 247, 0.22) 0%, rgba(13, 5, 26, 0.6) 42%, rgba(0, 0, 0, 1) 85%)',
        }}
      />

      {/* Giant Background Spider Legs Silhouette */}
      <svg
        viewBox="0 0 1000 600"
        className="home-spider-backdrop z-0"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Left Sprawling Legs */}
        <path
          d="M 500 240 C 410 140, 260 80, 120 120 C 70 140, 30 190, 10 260"
          stroke="rgba(168, 85, 247, 0.45)"
          strokeWidth="10"
          strokeLinecap="round"
        />
        <path
          d="M 480 260 C 370 180, 220 170, 90 240 C 50 270, 25 320, 15 390"
          stroke="rgba(168, 85, 247, 0.4)"
          strokeWidth="9"
          strokeLinecap="round"
        />
        <path
          d="M 470 290 C 350 250, 210 280, 110 380 C 75 420, 50 480, 45 550"
          stroke="rgba(168, 85, 247, 0.35)"
          strokeWidth="8"
          strokeLinecap="round"
        />
        <path
          d="M 460 320 C 380 340, 260 410, 180 500 C 150 540, 130 580, 125 600"
          stroke="rgba(168, 85, 247, 0.3)"
          strokeWidth="7"
          strokeLinecap="round"
        />

        {/* Right Sprawling Legs */}
        <path
          d="M 500 240 C 590 140, 740 80, 880 120 C 930 140, 970 190, 990 260"
          stroke="rgba(168, 85, 247, 0.45)"
          strokeWidth="10"
          strokeLinecap="round"
        />
        <path
          d="M 520 260 C 630 180, 780 170, 910 240 C 950 270, 975 320, 985 390"
          stroke="rgba(168, 85, 247, 0.4)"
          strokeWidth="9"
          strokeLinecap="round"
        />
        <path
          d="M 530 290 C 650 250, 790 280, 890 380 C 925 420, 950 480, 955 550"
          stroke="rgba(168, 85, 247, 0.35)"
          strokeWidth="8"
          strokeLinecap="round"
        />
        <path
          d="M 540 320 C 620 340, 740 410, 820 500 C 850 540, 870 580, 875 600"
          stroke="rgba(168, 85, 247, 0.3)"
          strokeWidth="7"
          strokeLinecap="round"
        />
      </svg>

      {/* Cyber Circuit Lines on Left & Right Margins */}
      <svg className="cyber-circuit-left z-0" viewBox="0 0 100 400" fill="none">
        <path
          d="M 10 20 L 70 80 L 70 200 L 30 240 L 30 380"
          stroke="rgba(168, 85, 247, 0.6)"
          strokeWidth="2"
        />
        <circle cx="70" cy="80" r="4" fill="#c084fc" />
        <circle cx="70" cy="200" r="4" fill="#a855f7" />
        <circle cx="30" cy="240" r="4" fill="#c084fc" />
      </svg>
      <svg className="cyber-circuit-right z-0" viewBox="0 0 100 400" fill="none">
        <path
          d="M 10 20 L 70 80 L 70 200 L 30 240 L 30 380"
          stroke="rgba(168, 85, 247, 0.6)"
          strokeWidth="2"
        />
        <circle cx="70" cy="80" r="4" fill="#c084fc" />
        <circle cx="70" cy="200" r="4" fill="#a855f7" />
        <circle cx="30" cy="240" r="4" fill="#c084fc" />
      </svg>

      {/* Ground Perspective Grid & Glowing Horizon Beam */}
      <div className="home-bg-perspective-grid z-0" />
      <div className="home-horizon-beam z-0" />

      {/* ═══════════════════════════════════════════════════════════════════
          TOP NAVIGATION BAR
      ═══════════════════════════════════════════════════════════════════ */}
      <header className="relative z-20 px-6 sm:px-10 py-5 flex items-center justify-between">
        {/* Brand Logo & Name */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#0e0720]/90 border border-purple-500/50 flex items-center justify-center shadow-[0_0_18px_rgba(168,85,247,0.5)]">
            <img
              src={mascotImage}
              alt="NikSpider"
              className="w-full h-full object-cover scale-125"
            />
          </div>
          <span className="text-xl font-black tracking-tight flex items-center">
            <span className="text-white">Nik</span>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-fuchsia-400 to-purple-500">
              Spider
            </span>
          </span>
        </div>

        {/* Right Action Buttons: Home Pill + Glow Intensity Toggle */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="px-4 py-1.5 rounded-full bg-black/60 hover:bg-purple-950/40 border border-purple-500/35 hover:border-purple-400 text-xs font-mono text-white flex items-center gap-2 transition cursor-pointer shadow-[0_0_14px_rgba(168,85,247,0.2)]"
          >
            <Home className="w-3.5 h-3.5 text-purple-300" />
            <span>Home</span>
          </button>

          <button
            type="button"
            onClick={() => setHighGlow((g) => !g)}
            title="Toggle Neon Glow"
            className="w-9 h-9 rounded-full bg-black/60 hover:bg-purple-950/40 border border-purple-500/35 hover:border-purple-400 text-purple-300 hover:text-white flex items-center justify-center transition cursor-pointer shadow-[0_0_14px_rgba(168,85,247,0.2)]"
          >
            <Sun className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* ═══════════════════════════════════════════════════════════════════
          CENTER HERO & TARGET VERIFICATION CARD
      ═══════════════════════════════════════════════════════════════════ */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 sm:px-6 py-6 max-w-4xl mx-auto w-full space-y-6">
        {/* 1. Squircle Mascot Container + Badge + Title + Tagline */}
        <div className="flex flex-col items-center text-center space-y-3">
          {/* Mascot Squircle */}
          <div className="mascot-squircle-frame w-40 h-40 sm:w-48 sm:h-48 overflow-hidden p-2 flex items-center justify-center">
            <img
              src={mascotImage}
              alt="NikSpider Mascot"
              className="w-full h-full object-cover object-center scale-110 drop-shadow-[0_0_20px_rgba(192,132,252,0.6)]"
            />
          </div>

          {/* Capsule Pill: AI APPSEC PLATFORM */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#130728]/90 border border-purple-500/50 text-[#c084fc] font-mono text-xs uppercase tracking-wider shadow-[0_0_16px_rgba(168,85,247,0.3)]">
            <Shield className="w-3.5 h-3.5 text-purple-400" />
            <span>AI APPSEC PLATFORM</span>
          </div>

          {/* Headline */}
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight leading-none">
            <span className="text-white">Nik</span>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-fuchsia-400 to-purple-500">
              Spider
            </span>
          </h1>

          {/* Subtitle / Tagline */}
          <p className="text-xs sm:text-sm text-zinc-400 max-w-md mx-auto leading-relaxed">
            Autonomous Web Security Agent — verify target ownership to unlock the live AppSec Command Center.
          </p>
        </div>

        {/* 2. Target Application URL Card */}
        <div className="home-target-card w-full max-w-2xl p-6 sm:p-7 space-y-5">
          {/* Card Title & Link Icon */}
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-full bg-purple-900/40 border border-purple-500/50 flex items-center justify-center text-purple-300 shadow-[0_0_14px_rgba(168,85,247,0.4)] shrink-0">
              <Link2 className="w-5 h-5 text-purple-300" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight leading-tight">
                Target Application URL
              </h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                Enter the URL of the application you want to verify
              </p>
            </div>
          </div>

          {/* Input & Verify Ownership Button */}
          <form onSubmit={handleSubmitUrl} className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 flex items-center bg-black/80 border border-purple-500/35 focus-within:border-purple-400 focus-within:shadow-[0_0_20px_rgba(168,85,247,0.35)] rounded-xl transition">
              <Globe className="w-4 h-4 text-purple-400 shrink-0 ml-3.5" />
              <input
                id="target-url-input"
                type="text"
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value);
                  if (pendingTarget) setPendingTarget(null);
                }}
                placeholder="http://localhost:5000 or https://example.com"
                className="w-full bg-transparent text-sm font-mono text-white placeholder-zinc-500 outline-none px-3 py-3"
                disabled={submitting || checking}
              />
            </div>

            <button
              type="submit"
              disabled={submitting || !url.trim()}
              className="btn-verify-gradient px-6 sm:px-7 py-3 rounded-xl text-white font-bold text-sm font-mono flex items-center justify-center gap-2 cursor-pointer shrink-0 disabled:opacity-40"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Generating...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>Verify Ownership →</span>
                </>
              )}
            </button>
          </form>

          {/* 3. Bottom Trust Badge Strip: Secure & Private | Powered by AI | Instant Verification */}
          <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-6 pt-2 border-t border-purple-500/20 text-xs text-zinc-400 font-mono">
            <div className="flex items-center gap-2">
              <Lock className="w-3.5 h-3.5 text-purple-400" />
              <span>Secure &amp; Private</span>
            </div>
            <span className="text-purple-500/40 select-none">|</span>
            <div className="flex items-center gap-2">
              <Zap className="w-3.5 h-3.5 text-fuchsia-400" />
              <span>Powered by AI</span>
            </div>
            <span className="text-purple-500/40 select-none">|</span>
            <div className="flex items-center gap-2">
              <Rocket className="w-3.5 h-3.5 text-purple-400" />
              <span>Instant Verification</span>
            </div>
          </div>
        </div>

        {/* 3. Challenge Box: Token + /.well-known/nikspider.txt Instructions (after URL submit) */}
        {pendingTarget && (
          <div className="w-full max-w-2xl rounded-2xl bg-[#090412]/95 border border-purple-500/45 p-6 shadow-[0_0_36px_rgba(168,85,247,0.25)] space-y-4 text-left">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-[#c084fc] flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-purple-400" />
                <span>Ownership Verification Challenge</span>
              </span>
              <button
                type="button"
                onClick={handleCopy}
                className="px-3 py-1 rounded-lg bg-black/80 hover:bg-purple-500/15 border border-purple-500/35 text-xs font-mono text-purple-200 flex items-center gap-1.5 transition cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-purple-400" />}
                <span>{copied ? 'Copied Token' : 'Copy Token'}</span>
              </button>
            </div>

            <pre className="p-4 rounded-xl bg-black border border-purple-500/30 font-mono text-xs text-purple-200 overflow-x-auto whitespace-pre-wrap select-all leading-relaxed">
              {instructionsBlock}
            </pre>

            <button
              type="button"
              onClick={handleCheckVerification}
              disabled={checking}
              className="w-full py-3.5 rounded-xl btn-verify-gradient disabled:opacity-50 text-white font-extrabold text-sm font-mono shadow-[0_0_24px_rgba(168,85,247,0.45)] transition flex items-center justify-center gap-2 cursor-pointer"
            >
              {checking ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Checking /.well-known/nikspider.txt...</span>
                </>
              ) : (
                <>
                  <span>Check Verification</span>
                  <ExternalLink className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        )}

        {/* Error notification */}
        {error && (
          <div className="w-full max-w-2xl p-4 rounded-xl bg-[#0e0416] border border-red-500/40 text-red-400 text-xs font-mono flex items-start gap-2.5 text-left shadow-[0_0_20px_rgba(239,68,68,0.2)]">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
      </main>

      {/* ═══════════════════════════════════════════════════════════════════
          FOOTER COPYRIGHT
      ═══════════════════════════════════════════════════════════════════ */}
      <footer className="relative z-10 py-3 text-center text-[11px] font-mono text-zinc-500">
        NikSpider AI AppSec Platform · Autonomous Web Security Engine
      </footer>
    </div>
  );
};

export default HomeVerifyGate;
