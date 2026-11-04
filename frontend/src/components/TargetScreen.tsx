import React, { useState, useEffect, useId } from 'react';
import { Target, ScanProfile } from '../types';
import { registerTarget, verifyTarget, checkBackendHealth } from '../api/client';
import { PROFILES } from '../styles/theme';
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
  Moon,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import './HomeVerifyGate.css';

export interface TargetScreenProps {
  onScanReady?: (target: Target) => void;
  onVerified?: (target: Target, profile?: ScanProfile) => void;
}

export const TargetScreen: React.FC<TargetScreenProps> = ({ onScanReady, onVerified }) => {
  // 3-Step State Machine: 1 = Register Target, 2 = Prove Ownership, 3 = Verified & Configure
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Target inputs and records
  const [url, setUrl] = useState<string>(
    () => import.meta.env.VITE_DEMO_TARGET_URL || 'http://localhost:5000'
  );
  const [target, setTarget] = useState<Target | null>(null);
  const [selectedProfile, setSelectedProfile] = useState<ScanProfile>('standard');

  // UI state
  const [loading, setLoading] = useState<boolean>(false);
  const [verifying, setVerifying] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isDemoMode, setIsDemoMode] = useState<boolean>(false);

  // Light/Dark Theme toggle (persisted in localStorage)
  const [themeMode, setThemeMode] = useState<'dark' | 'light'>(() => {
    try {
      return (localStorage.getItem('nikspider_theme_mode') as 'dark' | 'light') || 'dark';
    } catch {
      return 'dark';
    }
  });

  const urlInputId = useId();
  const errorAlertId = useId();

  // Check backend health on mount to detect demo mode
  useEffect(() => {
    let cancelled = false;
    checkBackendHealth()
      .then((h) => {
        if (!cancelled && h.demoMode) {
          setIsDemoMode(true);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const toggleTheme = () => {
    const next = themeMode === 'dark' ? 'light' : 'dark';
    setThemeMode(next);
    try {
      localStorage.setItem('nikspider_theme_mode', next);
    } catch {}
  };

  // Helper to validate URL format
  const validateUrl = (raw: string): boolean => {
    try {
      const parsed = new URL(raw);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  };

  // ═══════════════════════════════════════════════════════════════════
  // STEP 1 SUBMIT: REGISTER TARGET (POST /api/v2/targets)
  // ═══════════════════════════════════════════════════════════════════
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = url.trim();
    if (!trimmed) return;

    if (!validateUrl(trimmed)) {
      setError('Please enter a valid HTTP or HTTPS URL (e.g., http://localhost:5000 or https://example.com).');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const created = await registerTarget(trimmed);
      setTarget(created);
      setStep(2);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to register target.';
      if (
        msg.toLowerCase().includes('blocked') ||
        msg.toLowerCase().includes('private') ||
        msg.toLowerCase().includes('restricted') ||
        msg.toLowerCase().includes('ssrf') ||
        msg.toLowerCase().includes('loopback')
      ) {
        setError(
          "This address is blocked by NikSpider's safety guard. Use a publicly reachable domain you own."
        );
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  // ═══════════════════════════════════════════════════════════════════
  // STEP 2 SUBMIT: PROVE OWNERSHIP (POST /api/v2/targets/{id}/verify)
  // ═══════════════════════════════════════════════════════════════════
  const handleVerifyNow = async () => {
    if (!target) return;
    setVerifying(true);
    setError(null);

    try {
      const verified = await verifyTarget(target.id);
      if (verified) {
        setTarget({ ...target, verified: true });
        setStep(3);
      } else {
        setError(
          'Token not found at /.well-known/nikspider.txt. Check the file content and try again.'
        );
      }
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : 'Network or server error during verification. Please retry.'
      );
    } finally {
      setVerifying(false);
    }
  };

  // ═══════════════════════════════════════════════════════════════════
  // STEP 3 SUBMIT: LAUNCH COMMAND CENTER
  // ═══════════════════════════════════════════════════════════════════
  const handleLaunchCommandCenter = () => {
    if (!target) return;
    const verifiedTarget = { ...target, verified: true };
    if (onVerified) {
      onVerified(verifiedTarget, selectedProfile);
    }
    if (onScanReady) {
      onScanReady(verifiedTarget);
    }
  };

  const copyToken = () => {
    if (!target) return;
    const tokenStr = `nikspider-verify=${target.token}`;
    navigator.clipboard.writeText(tokenStr);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const wellKnownPath = target
    ? `${target.url.replace(/\/$/, '')}/.well-known/nikspider.txt`
    : '';

  const targetHostname = target?.url ? new URL(target.url).host : null;

  return (
    <div
      className={`min-h-screen bg-[#05030A] text-white flex flex-col justify-between relative overflow-hidden select-none sm:select-auto ${
        themeMode === 'light' ? 'theme-cyber-light' : ''
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
            'radial-gradient(circle at 50% 30%, rgba(124, 58, 237, 0.24) 0%, rgba(168, 85, 247, 0.12) 36%, rgba(5, 3, 10, 0.95) 75%)',
        }}
      />

      {/* Huge Faint Mechanical Spider Silhouette Spreading Across Both Sides */}
      <svg
        viewBox="0 0 1100 620"
        className="bg-spider-drift z-0 hidden md:block"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        {/* Left Articulated Cyber Legs */}
        <path
          d="M 550 250 C 450 140, 280 80, 110 120 C 50 140, 20 200, 10 280"
          stroke="rgba(168, 85, 247, 0.45)"
          strokeWidth="11"
          strokeLinecap="round"
        />
        <path
          d="M 530 270 C 400 180, 230 170, 80 250 C 35 290, 15 350, 12 420"
          stroke="rgba(168, 85, 247, 0.38)"
          strokeWidth="9"
          strokeLinecap="round"
        />
        <path
          d="M 520 300 C 380 260, 220 290, 110 400 C 70 450, 45 520, 40 600"
          stroke="rgba(168, 85, 247, 0.32)"
          strokeWidth="8"
          strokeLinecap="round"
        />
        <path
          d="M 510 330 C 410 360, 270 440, 180 540 C 150 580, 130 610, 120 620"
          stroke="rgba(168, 85, 247, 0.28)"
          strokeWidth="7"
          strokeLinecap="round"
        />

        {/* Right Articulated Cyber Legs */}
        <path
          d="M 550 250 C 650 140, 820 80, 990 120 C 1050 140, 1080 200, 1090 280"
          stroke="rgba(168, 85, 247, 0.45)"
          strokeWidth="11"
          strokeLinecap="round"
        />
        <path
          d="M 570 270 C 700 180, 870 170, 1020 250 C 1065 290, 1085 350, 1088 420"
          stroke="rgba(168, 85, 247, 0.38)"
          strokeWidth="9"
          strokeLinecap="round"
        />
        <path
          d="M 580 300 C 720 260, 880 290, 990 400 C 1030 450, 1055 520, 1060 600"
          stroke="rgba(168, 85, 247, 0.32)"
          strokeWidth="8"
          strokeLinecap="round"
        />
        <path
          d="M 590 330 C 690 360, 830 440, 920 540 C 950 580, 970 610, 980 620"
          stroke="rgba(168, 85, 247, 0.28)"
          strokeWidth="7"
          strokeLinecap="round"
        />
      </svg>

      {/* Angular Neon Circuit-Line Borders on Left & Right */}
      <svg className="cyber-circuit-bracket left z-0 hidden lg:block" viewBox="0 0 110 420" fill="none" aria-hidden="true">
        <path d="M 12 18 L 82 88 L 82 220 L 32 270 L 32 400" stroke="rgba(168, 85, 247, 0.65)" strokeWidth="2.5" />
        <circle cx="82" cy="88" r="4.5" fill="#c084fc" />
        <circle cx="82" cy="220" r="4.5" fill="#d946ef" />
        <circle cx="32" cy="270" r="4.5" fill="#a855f7" />
      </svg>
      <svg className="cyber-circuit-bracket right z-0 hidden lg:block" viewBox="0 0 110 420" fill="none" aria-hidden="true">
        <path d="M 12 18 L 82 88 L 82 220 L 32 270 L 32 400" stroke="rgba(168, 85, 247, 0.65)" strokeWidth="2.5" />
        <circle cx="82" cy="88" r="4.5" fill="#c084fc" />
        <circle cx="82" cy="220" r="4.5" fill="#d946ef" />
        <circle cx="32" cy="270" r="4.5" fill="#a855f7" />
      </svg>

      {/* Perspective Grid Floor & Horizontal Neon Line */}
      <div className="home-perspective-floor z-0" aria-hidden="true" />
      <div className="home-horizontal-neon-line z-0" aria-hidden="true" />

      {/* Purple Fog / Smoke at Bottom Corners */}
      <div className="home-corner-fog-left z-0" aria-hidden="true" />
      <div className="home-corner-fog-right z-0" aria-hidden="true" />

      {/* ═══════════════════════════════════════════════════════════════════
          1. NAVBAR (ABSOLUTE TOP)
      ═══════════════════════════════════════════════════════════════════ */}
      <header className="relative z-30 px-6 sm:px-12 py-5 flex items-center justify-between animate-stagger-1">
        {/* Left: Spider Logo Icon + Wordmark */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#0e0720]/90 border border-purple-500/60 flex items-center justify-center shadow-[0_0_18px_rgba(168,85,247,0.55)] shrink-0">
            <img
              src={mascotImage}
              alt="NikSpider Logo"
              className="w-full h-full object-cover scale-125"
            />
          </div>
          <span className="text-xl font-cyber font-bold tracking-tight">
            <span className="text-white">Nik</span>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-fuchsia-400 to-purple-500">
              Spider
            </span>
          </span>
        </div>

        {/* Right: Home Pill + Theme Toggle */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              setStep(1);
              setError(null);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="px-4 py-1.5 rounded-full bg-black/60 hover:bg-purple-950/40 border border-purple-500/40 hover:border-purple-300 text-xs font-mono text-white flex items-center gap-2 transition cursor-pointer shadow-[0_0_14px_rgba(168,85,247,0.25)]"
          >
            <Home className="w-3.5 h-3.5 text-purple-300" />
            <span>Home</span>
          </button>

          <button
            type="button"
            onClick={toggleTheme}
            title={themeMode === 'dark' ? 'Switch to Cyber Light mode' : 'Switch to Dark mode'}
            className="w-9 h-9 rounded-full bg-black/60 hover:bg-purple-950/40 border border-purple-500/40 hover:border-purple-300 text-purple-300 hover:text-white flex items-center justify-center transition cursor-pointer shadow-[0_0_14px_rgba(168,85,247,0.25)]"
          >
            {themeMode === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* ═══════════════════════════════════════════════════════════════════
          MAIN CENTER COLUMN (HERO, TITLE & 3-STEP GLASS CARD)
      ═══════════════════════════════════════════════════════════════════ */}
      <main className="relative z-20 flex-1 flex flex-col items-center justify-center px-4 sm:px-6 py-6 max-w-5xl mx-auto w-full space-y-6">
        {/* 2. Hero Image: ~250px Rounded Square Cyber-Spider */}
        <div className="relative animate-stagger-2">
          <div className="hero-radial-glow-backdrop" aria-hidden="true" />
          <div className="hero-squircle-glow overflow-hidden p-3 flex items-center justify-center">
            <img
              src={mascotImage}
              alt="NikSpider Cyber-Spider Mascot"
              className="w-full h-full object-cover object-center scale-110 drop-shadow-[0_0_24px_rgba(192,132,252,0.7)]"
            />
          </div>
        </div>

        {/* 3. Badge Pill: AI APPSEC PLATFORM */}
        <div className="animate-stagger-3">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#130728]/95 border border-purple-500/50 text-[#c084fc] font-mono text-xs uppercase tracking-[0.16em] shadow-[0_0_20px_rgba(168,85,247,0.35)]">
            <ShieldCheck className="w-4 h-4 text-purple-400" />
            <span>AI APPSEC PLATFORM</span>
          </div>
        </div>

        {/* 4. Big Title & 5. Subtitle */}
        <div className="text-center space-y-2 animate-stagger-3">
          <h1 className="text-5xl sm:text-7xl lg:text-8xl font-cyber font-black tracking-tight leading-none">
            <span className="text-transparent bg-clip-text bg-gradient-to-b from-white via-slate-100 to-slate-400 drop-shadow-[0_4px_16px_rgba(255,255,255,0.15)]">
              Nik
            </span>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#A855F7] via-[#C084FC] to-[#D946EF] drop-shadow-[0_0_35px_rgba(168,85,247,0.5)]">
              Spider
            </span>
          </h1>

          <p className="text-sm sm:text-base lg:text-lg text-zinc-300 max-w-2xl mx-auto leading-relaxed pt-1">
            Autonomous Web Security Agent — verify target ownership to unlock the live{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-fuchsia-300 to-purple-400 font-semibold drop-shadow-[0_0_12px_rgba(168,85,247,0.7)]">
              AppSec Command Center
            </span>
            .
          </p>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════
            6. MAIN GLASS CARD (3-STEP STATE MACHINE, MAX-W ~1080PX)
        ═══════════════════════════════════════════════════════════════════ */}
        <div className="scifi-chamfered-card w-full max-w-4xl p-6 sm:p-8 space-y-6 animate-stagger-4">
          {/* STEP 1: REGISTER TARGET */}
          {step === 1 && (
            <div className="space-y-5">
              {/* Header Row */}
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-full bg-purple-900/40 border border-purple-500/50 flex items-center justify-center text-purple-300 shadow-[0_0_16px_rgba(168,85,247,0.45)] shrink-0">
                  <Link2 className="w-5 h-5 text-purple-300" />
                </div>
                <div>
                  <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight leading-tight">
                    Target Application URL
                  </h2>
                  <p className="text-xs sm:text-sm text-zinc-400 mt-0.5">
                    Enter the URL of the application you want to verify
                  </p>
                </div>
              </div>

              {/* Input Row */}
              <form onSubmit={handleRegister} className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1 flex items-center bg-black/85 border border-purple-500/40 focus-within:border-purple-400 focus-within:ring-2 focus-within:ring-purple-500/40 focus-within:shadow-[0_0_24px_rgba(168,85,247,0.4)] rounded-xl transition">
                  <label htmlFor={urlInputId} className="sr-only">
                    Target URL
                  </label>
                  <Globe className="w-4 h-4 text-purple-400 shrink-0 ml-3.5" aria-hidden="true" />
                  <input
                    id={urlInputId}
                    type="text"
                    value={url}
                    onChange={(e) => {
                      setUrl(e.target.value);
                      if (error) setError(null);
                    }}
                    placeholder="http://localhost:5000"
                    className="w-full bg-transparent text-sm font-mono text-white placeholder-zinc-500 outline-none px-3 py-3.5"
                    disabled={loading}
                    aria-describedby={error ? errorAlertId : undefined}
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading || !url.trim()}
                  className="btn-violet-magenta px-7 py-3.5 rounded-xl text-white font-bold text-sm font-mono flex items-center justify-center gap-2 cursor-pointer shrink-0 disabled:opacity-40"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Generating Proof...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4" />
                      <span>Verify Ownership →</span>
                    </>
                  )}
                </button>
              </form>
            </div>
          )}

          {/* STEP 2: PROVE OWNERSHIP */}
          {step === 2 && target && (
            <div className="space-y-5 animate-stagger-1 text-left">
              {/* Header Row */}
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-purple-900/40 border border-purple-500/50 flex items-center justify-center text-purple-300 shadow-[0_0_14px_rgba(168,85,247,0.45)] shrink-0">
                    <Lock className="w-5 h-5 text-purple-300" />
                  </div>
                  <div>
                    <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                      Step 2: Prove Domain Ownership
                    </h2>
                    <p className="text-xs text-zinc-400">
                      Serve this exact token at target application&apos;s well-known path
                    </p>
                  </div>
                </div>

                {isDemoMode && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-semibold bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 shadow-[0_0_16px_rgba(16,185,129,0.25)]">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                    <span>DEMO MODE: token auto-synced, one click to verify</span>
                  </span>
                )}
              </div>

              {/* Instructions and Token Box */}
              <div className="rounded-xl bg-black/85 border border-purple-500/35 p-4 space-y-3 font-mono text-xs">
                <div className="text-zinc-400">
                  Serve this exact token at:
                  <div className="mt-1 text-purple-300 bg-purple-950/40 px-3 py-2 rounded-lg border border-purple-500/25 select-all break-all">
                    {wellKnownPath}
                  </div>
                </div>

                <div>
                  <div className="text-zinc-400 mb-1">File contents (exact token string):</div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-purple-950/40 px-3 py-2 rounded-lg border border-purple-500/25 text-fuchsia-300 font-bold select-all overflow-hidden text-ellipsis">
                      nikspider-verify={target.token}
                    </div>
                    <button
                      type="button"
                      onClick={copyToken}
                      className="px-3.5 py-2 rounded-lg bg-purple-600/30 hover:bg-purple-600/50 border border-purple-400/50 text-white flex items-center gap-1.5 cursor-pointer transition shrink-0"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-purple-300" />}
                      <span>{copied ? 'Copied!' : 'Copy'}</span>
                    </button>
                  </div>
                </div>

                <p className="text-[11px] text-zinc-400 font-sans pt-1">
                  How-to: 1. Deploy the file above returning HTTP 200 with the exact token. 2. Click &quot;Verify Now&quot; to execute cryptographic proof check.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setStep(1);
                    setError(null);
                  }}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-black/60 hover:bg-purple-950/40 border border-purple-500/30 text-xs font-mono text-zinc-300 hover:text-white flex items-center justify-center gap-1.5 cursor-pointer transition"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Change URL</span>
                </button>

                <button
                  type="button"
                  onClick={handleVerifyNow}
                  disabled={verifying}
                  className="w-full sm:w-auto btn-violet-magenta px-8 py-3 rounded-xl text-white font-bold text-sm font-mono flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {verifying ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Checking /.well-known/nikspider.txt...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4" />
                      <span>Verify Now →</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: VERIFIED & PROFILE CONFIGURATION */}
          {step === 3 && target && (
            <div className="space-y-6 animate-stagger-1 text-left">
              {/* Success Badge */}
              <div className="flex items-center justify-between flex-wrap gap-2 border-b border-purple-500/20 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-500/20 border border-emerald-400 flex items-center justify-center text-emerald-400 shadow-[0_0_18px_rgba(16,185,129,0.5)]">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                      <span>Ownership Verified</span>
                      <span className="text-xs font-mono font-normal text-emerald-400 bg-emerald-950/60 px-2.5 py-0.5 rounded-full border border-emerald-500/40">
                        Active Scope Lock
                      </span>
                    </h2>
                    <p className="text-xs text-zinc-400 mt-0.5 font-mono">
                      Domain {targetHostname || target.url} is unlocked for autonomous scanning.
                    </p>
                  </div>
                </div>
              </div>

              {/* Segmented Control Policy Profile Selector */}
              <div className="space-y-2.5">
                <label className="block text-xs font-mono uppercase tracking-wider text-purple-300">
                  Select Policy Profile Before Launch:
                </label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {[
                    {
                      id: 'safe' as const,
                      label: 'safe',
                      budget: '50 requests',
                      tag: 'Passive only',
                      description: 'Passive/header checks only.',
                    },
                    {
                      id: 'standard' as const,
                      label: 'standard',
                      budget: '500 requests',
                      tag: '[default]',
                      description: 'All 13 non-destructive modules.',
                    },
                    {
                      id: 'aggressive' as const,
                      label: 'aggressive',
                      budget: '2000 requests',
                      tag: 'Full suite',
                      description: 'Full suite autonomous probes.',
                    },
                  ].map((p) => {
                    const active = selectedProfile === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setSelectedProfile(p.id)}
                        className={`p-3.5 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
                          active
                            ? 'bg-purple-600/30 border-purple-400 shadow-[0_0_20px_rgba(168,85,247,0.4)]'
                            : 'bg-black/70 border-purple-500/20 hover:border-purple-500/45 text-zinc-400'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between font-mono text-xs">
                            <span className="font-bold text-white uppercase">{p.label}</span>
                            <span className="text-[11px] text-purple-300 font-mono">
                              ({p.budget})
                            </span>
                          </div>
                          <p className="text-[11px] text-zinc-400 font-sans mt-1.5 leading-snug">
                            {p.description}
                          </p>
                        </div>
                        <div className="mt-2 text-[10px] font-mono text-purple-400">
                          {p.tag}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Launch Command Center Button */}
              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={handleLaunchCommandCenter}
                  className="w-full sm:w-auto btn-violet-magenta px-8 py-3.5 rounded-xl text-white font-bold text-sm font-mono flex items-center justify-center gap-2 cursor-pointer shadow-[0_0_30px_rgba(168,85,247,0.65)]"
                >
                  <Rocket className="w-4 h-4" />
                  <span>Launch Command Center →</span>
                </button>
              </div>
            </div>
          )}

          {/* Inline Error Notification with Red/Magenta Glow and aria-live */}
          {error && (
            <div
              id={errorAlertId}
              role="alert"
              aria-live="polite"
              className="p-4 rounded-xl bg-[#12041a] border border-red-500/50 text-red-300 text-xs font-mono flex items-start justify-between gap-3 text-left shadow-[0_0_24px_rgba(239,68,68,0.25)] animate-stagger-1"
            >
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
              {step === 2 && (
                <button
                  type="button"
                  onClick={handleVerifyNow}
                  className="px-2.5 py-1 rounded bg-red-950 hover:bg-red-900 border border-red-500/40 text-red-200 text-[11px] flex items-center gap-1 cursor-pointer shrink-0"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Retry</span>
                </button>
              )}
            </div>
          )}

          {/* Footer Strip on Main Glass Card */}
          <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-6 pt-3 border-t border-purple-500/20 text-xs text-zinc-400 font-mono">
            {step === 1 ? (
              <>
                <div className="flex items-center gap-2">
                  <Lock className="w-3.5 h-3.5 text-purple-400" />
                  <span>Secure & Private</span>
                </div>
                <span className="text-purple-500/40 select-none hidden sm:inline">|</span>
                <div className="flex items-center gap-2">
                  <Zap className="w-3.5 h-3.5 text-fuchsia-400" />
                  <span>Powered by AI</span>
                </div>
                <span className="text-purple-500/40 select-none hidden sm:inline">|</span>
                <div className="flex items-center gap-2">
                  <Rocket className="w-3.5 h-3.5 text-purple-400" />
                  <span>Instant Verification</span>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <Shield className="w-3.5 h-3.5 text-purple-400" />
                  <span>Ownership-Verified Scans</span>
                </div>
                <span className="text-purple-500/40 select-none hidden sm:inline">|</span>
                <div className="flex items-center gap-2">
                  <Zap className="w-3.5 h-3.5 text-fuchsia-400" />
                  <span>Non-Destructive Probes</span>
                </div>
                <span className="text-purple-500/40 select-none hidden sm:inline">|</span>
                <div className="flex items-center gap-2">
                  <Rocket className="w-3.5 h-3.5 text-purple-400" />
                  <span>AI-Triaged Results</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Security Guarantees Strip (3 items with purple outline icons) */}
        <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-6 text-xs text-purple-300/80 font-mono animate-stagger-5">
          <div className="flex items-center gap-2">
            <Shield className="w-3.5 h-3.5 text-purple-400" />
            <span>Ownership-Verified Scans</span>
          </div>
          <span className="text-purple-500/40 select-none hidden sm:inline">|</span>
          <div className="flex items-center gap-2">
            <Zap className="w-3.5 h-3.5 text-fuchsia-400" />
            <span>Non-Destructive Probes</span>
          </div>
          <span className="text-purple-500/40 select-none hidden sm:inline">|</span>
          <div className="flex items-center gap-2">
            <Rocket className="w-3.5 h-3.5 text-purple-400" />
            <span>AI-Triaged Results</span>
          </div>
        </div>
      </main>

      {/* ═══════════════════════════════════════════════════════════════════
          FOOTER COPYRIGHT
      ═══════════════════════════════════════════════════════════════════ */}
      <footer className="relative z-20 py-4 text-center text-xs font-mono text-zinc-500 animate-stagger-5">
        NikSpider AI AppSec Platform · Autonomous Web Security Engine
      </footer>
    </div>
  );
};

export default TargetScreen;
