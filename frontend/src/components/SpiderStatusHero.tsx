import React, { useEffect, useRef, useState, useMemo } from 'react';
import mascotImage from '../assets/nikspider-dashboard-spider.png';
import { ScanProfile, TriageResult, Severity } from '../types';
import { PROFILES } from '../styles/theme';
import { askSpiderAssistant } from '../api/client';
import {
  CheckCircle2,
  Play,
  Pause,
  Square,
  Sparkles,
  X,
  MessageSquare,
  Send,
  Filter,
  Terminal,
  Download,
  ShieldAlert,
  RefreshCw,
  Loader2,
} from 'lucide-react';
import './SpiderStatusHero.css';

export interface SpiderCliLine {
  id: string;
  text: string;
  tone: 'ok' | 'warn' | 'violet';
}

export interface LegModuleCluster {
  legIndex: number; // 1..8
  side: 'left' | 'right';
  shortLabel: string;
  fullName: string;
  modules: string[];
  topPct: number;
  leftPct: number;
}

export const SPIDER_LEGS: LegModuleCluster[] = [
  {
    legIndex: 1,
    side: 'left',
    shortLabel: 'SQLi',
    fullName: 'SQL Injection Module',
    modules: ['sqli'],
    topPct: 42,
    leftPct: 18,
  },
  {
    legIndex: 2,
    side: 'left',
    shortLabel: 'XSS',
    fullName: 'Cross-Site Scripting Module',
    modules: ['xss'],
    topPct: 54,
    leftPct: 13,
  },
  {
    legIndex: 3,
    side: 'left',
    shortLabel: 'SSRF',
    fullName: 'Server-Side Request Forgery',
    modules: ['ssrf'],
    topPct: 66,
    leftPct: 18,
  },
  {
    legIndex: 4,
    side: 'left',
    shortLabel: 'IDOR/Access',
    fullName: 'Access Control, IDOR & CSRF',
    modules: ['access', 'idor', 'csrf', 'access_control'],
    topPct: 78,
    leftPct: 25,
  },
  {
    legIndex: 5,
    side: 'right',
    shortLabel: 'Session',
    fullName: 'Session & Cookie Security',
    modules: ['session', 'auth'],
    topPct: 42,
    leftPct: 82,
  },
  {
    legIndex: 6,
    side: 'right',
    shortLabel: 'Headers',
    fullName: 'Security Headers & CSP',
    modules: ['headers', 'security_headers'],
    topPct: 54,
    leftPct: 87,
  },
  {
    legIndex: 7,
    side: 'right',
    shortLabel: 'CORS/Click',
    fullName: 'CORS Policy & Clickjacking',
    modules: ['cors', 'clickjacking'],
    topPct: 66,
    leftPct: 82,
  },
  {
    legIndex: 8,
    side: 'right',
    shortLabel: 'Surface',
    fullName: 'Open Redirect, Exposed Files & Cache',
    modules: ['open_redirect', 'exposed_files', 'cache', 'info_disclosure', 'graphql', 'rce'],
    topPct: 78,
    leftPct: 75,
  },
];

interface SeverityEyeConfig {
  id: Severity;
  label: string;
  color: string;
  glowRgba: string;
  topPct: number;
  leftPct: number;
}

const SEVERITY_EYES: SeverityEyeConfig[] = [
  {
    id: 'Critical',
    label: 'Critical Severity Eye',
    color: '#ef4444',
    glowRgba: '239, 68, 68',
    topPct: 59.0,
    leftPct: 47.2,
  },
  {
    id: 'High',
    label: 'High Severity Eye',
    color: '#f59e0b',
    glowRgba: '245, 158, 11',
    topPct: 56.7,
    leftPct: 52.5,
  },
  {
    id: 'Medium',
    label: 'Medium Severity Eye',
    color: '#c084fc',
    glowRgba: '192, 132, 252',
    topPct: 64.3,
    leftPct: 47.1,
  },
  {
    id: 'Low',
    label: 'Low Severity Eye',
    color: '#38bdf8',
    glowRgba: '56, 189, 248',
    topPct: 64.3,
    leftPct: 54.0,
  },
];

interface SpiderStatusHeroProps {
  activeScanId: string | null;
  isScanning: boolean;
  isPaused: boolean;
  scanComplete: boolean;
  progressPct: number;
  eventPulseTick: number;
  confirmedFlashTick: number;
  cliLines: SpiderCliLine[];
  currentStage: number;
  requestsSent: number;
  elapsedFormatted: string;
  activeProfile: ScanProfile;
  onChangeProfile: (p: ScanProfile) => void;
  onQuickStartScan: (profile?: ScanProfile) => void;
  onControlScan: (action: 'pause' | 'resume' | 'stop') => Promise<void>;
  // Tier 1 & Tier 2: Module Leg & Eye Severity Telemetry + Interactive Table Filtering
  moduleProbeCounts: Record<string, number>;
  activeProbingModule: string | null;
  lastConfirmedModule: string | null;
  findings: TriageResult[];
  selectedModuleFilter: string[] | null;
  selectedLegLabel: string | null;
  onToggleLegFilter: (leg: LegModuleCluster | null) => void;
  selectedSeverityFilter: Severity | null;
  onSelectSeverityFilter: (sev: Severity | null) => void;
  lookDirection: 'none' | 'left' | 'center-left' | 'center' | 'right';
  // Context Menu & Tier 3 Retest / Navigation Callbacks
  onJumpToTerminal: () => void;
  onSelectFinding: (findingId: string) => void;
  onDropRetestFinding: (findingId: string) => Promise<void>;
}

export const SpiderStatusHero: React.FC<SpiderStatusHeroProps> = ({
  activeScanId,
  isScanning,
  isPaused,
  scanComplete,
  progressPct,
  eventPulseTick,
  confirmedFlashTick,
  cliLines,
  currentStage,
  requestsSent,
  elapsedFormatted,
  activeProfile,
  onChangeProfile,
  onQuickStartScan,
  onControlScan,
  moduleProbeCounts,
  activeProbingModule,
  lastConfirmedModule,
  findings,
  selectedModuleFilter,
  selectedLegLabel,
  onToggleLegFilter,
  selectedSeverityFilter,
  onSelectSeverityFilter,
  lookDirection,
  onJumpToTerminal,
  onSelectFinding,
  onDropRetestFinding,
}) => {
  const [pulseActive, setPulseActive] = useState(false);
  const [alertFlash, setAlertFlash] = useState(false);

  // Tier 1 Modals: Start Scan Modal (when idle) & Scan Control Modal (when scanning/paused)
  const [showStartModal, setShowStartModal] = useState(false);
  const [showControlModal, setShowControlModal] = useState(false);

  // Tier 1 Right-click / Long-press Quick Context Menu
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [showLastFiveInMenu, setShowLastFiveInMenu] = useState(false);
  const longPressTimerRef = useRef<number | null>(null);

  // Hovered Leg & Hovered Eye Tooltips
  const [hoveredLeg, setHoveredLeg] = useState<LegModuleCluster | null>(null);
  const [hoveredEye, setHoveredEye] = useState<SeverityEyeConfig | null>(null);

  // Tier 3: Anchored Spider Mini-Chat Popover (Stage 3.5 Gateway)
  const [chatOpen, setChatOpen] = useState(false);
  const [chatQuestion, setChatQuestion] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatHistory, setChatHistory] = useState<
    { id: string; role: 'user' | 'spider'; text: string }[]
  >([
    {
      id: 'welcome',
      role: 'spider',
      text: 'Ask me anything about the active scan — e.g. "What is my riskiest endpoint?" or "What should I fix first?"',
    },
  ]);

  // Tier 3: Drag-a-"FIXED?"-badge onto Spider to trigger 1-click live retest
  const [dragOverActive, setDragOverActive] = useState(false);
  const [retestBanner, setRetestBanner] = useState<string | null>(null);

  // Tier 3: Throttled HTTP Request Pulse Beam (1 pulse per batch of requests/events)
  const [pulseBeamKey, setPulseBeamKey] = useState<number>(0);
  const lastBeamTimeRef = useRef<number>(0);

  useEffect(() => {
    if (eventPulseTick === 0) return;
    setPulseActive(true);
    const now = Date.now();
    // Throttle photon beam so high RPS produces clean 650ms pulses
    if (now - lastBeamTimeRef.current > 650) {
      lastBeamTimeRef.current = now;
      setPulseBeamKey((k) => k + 1);
    }
    const t = setTimeout(() => setPulseActive(false), 320);
    return () => clearTimeout(t);
  }, [eventPulseTick]);

  useEffect(() => {
    if (confirmedFlashTick === 0) return;
    setAlertFlash(true);
    const t = setTimeout(() => setAlertFlash(false), 420);
    return () => clearTimeout(t);
  }, [confirmedFlashTick]);

  // Compute live confirmed counts per severity tier for the 4 glowing eyes
  const confirmedFindings = useMemo(
    () => findings.filter((f) => f.verdict === 'confirmed'),
    [findings]
  );

  const severityCounts = useMemo(() => {
    const counts: Record<Severity, number> = {
      Critical: 0,
      High: 0,
      Medium: 0,
      Low: 0,
    };
    confirmedFindings.forEach((f) => {
      const s = (f.severity || 'Medium') as Severity;
      if (counts[s] !== undefined) {
        counts[s] += 1;
      }
    });
    return counts;
  }, [confirmedFindings]);

  // Compute per-leg stats (probes sent + confirmed count)
  const getLegStats = (leg: LegModuleCluster) => {
    let probes = 0;
    leg.modules.forEach((m) => {
      probes += moduleProbeCounts[m] || 0;
    });
    const confirmed = confirmedFindings.filter((f) =>
      leg.modules.includes((f.module || '').toLowerCase())
    ).length;
    const isProbing =
      isScanning &&
      !isPaused &&
      activeProbingModule !== null &&
      leg.modules.includes(activeProbingModule.toLowerCase());
    const justConfirmed =
      alertFlash &&
      lastConfirmedModule !== null &&
      leg.modules.includes(lastConfirmedModule.toLowerCase());
    const isSelected =
      selectedModuleFilter !== null &&
      leg.modules.some((m) => selectedModuleFilter.includes(m));

    return { probes, confirmed, isProbing, justConfirmed, isSelected };
  };

  // Click-to-Act on Spider Chassis
  const handleSpiderChassisClick = () => {
    if (contextMenu) {
      setContextMenu(null);
      return;
    }
    if (isScanning || isPaused) {
      setShowControlModal(true);
    } else {
      setShowStartModal(true);
    }
  };

  // Right-click or Long-press handler
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    setContextMenu({
      x: Math.min(e.clientX - rect.left, rect.width - 230),
      y: Math.min(e.clientY - rect.top, rect.height - 190),
    });
    setShowLastFiveInMenu(false);
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clientX = e.clientX;
    const clientY = e.clientY;
    longPressTimerRef.current = window.setTimeout(() => {
      setContextMenu({
        x: Math.min(clientX - rect.left, rect.width - 230),
        y: Math.min(clientY - rect.top, rect.height - 190),
      });
      setShowLastFiveInMenu(false);
    }, 520);
  };

  const cancelLongPress = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  // Tier 3: Ask Spider Mini-Chat submit
  const handleAskSpider = async (questionText?: string) => {
    const q = (questionText ?? chatQuestion).trim();
    if (!q || chatLoading) return;
    setChatQuestion('');
    setChatHistory((prev) => [
      ...prev,
      { id: `u-${Date.now()}`, role: 'user', text: q },
    ]);

    if (!activeScanId) {
      setChatHistory((prev) => [
        ...prev,
        {
          id: `s-${Date.now()}`,
          role: 'spider',
          text:
            confirmedFindings.length === 0
              ? 'No scan has run yet. Click my chassis to open the Start Scan modal first!'
              : `You have ${confirmedFindings.length} confirmed finding(s). Start or select a scan to query full endpoint telemetry.`,
        },
      ]);
      return;
    }

    setChatLoading(true);
    try {
      const res = await askSpiderAssistant(activeScanId, q);
      setChatHistory((prev) => [
        ...prev,
        { id: `s-${Date.now()}`, role: 'spider', text: res.answer },
      ]);
    } catch {
      setChatHistory((prev) => [
        ...prev,
        {
          id: `s-${Date.now()}`,
          role: 'spider',
          text: `Grounded summary: ${confirmedFindings.length} confirmed findings (${severityCounts.Critical} Critical, ${severityCounts.High} High).`,
        },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  // Tier 3: Drag-and-Drop "FIXED?" badge onto Spider to trigger live retest
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    if (!dragOverActive) setDragOverActive(true);
  };

  const handleDragLeave = () => {
    setDragOverActive(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverActive(false);
    const findingId =
      e.dataTransfer.getData('text/nikspider-finding-id') ||
      e.dataTransfer.getData('text/plain');
    if (!findingId) return;

    setRetestBanner(`Re-probing finding ${findingId.slice(0, 8)}...`);
    try {
      await onDropRetestFinding(findingId);
      setRetestBanner(`✓ Live Retest complete for ${findingId.slice(0, 8)}`);
    } catch {
      setRetestBanner(`⚠ Retest request failed for ${findingId.slice(0, 8)}`);
    }
    setTimeout(() => setRetestBanner(null), 4000);
  };

  const visibleCli = cliLines.slice(-8);
  const lookClass = lookDirection !== 'none' ? `look-${lookDirection}` : '';

  return (
    <div
      className={`spider-hero-stage select-none ${alertFlash ? 'alert-flash' : ''} ${
        dragOverActive ? 'drop-target-active' : ''
      }`}
      onContextMenu={handleContextMenu}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Top Overlay Header: Title + Active Filter Pills + State-Driven Status Pill */}
      <div className="absolute top-3.5 left-4 right-4 z-20 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-[#0e0720]/90 border border-[#a855f7]/50 flex items-center justify-center shadow-[0_0_18px_rgba(168,85,247,0.4)]">
            <Sparkles className="w-4 h-4 text-[#c084fc]" />
          </div>
          <div>
            <div className="text-sm font-extrabold text-white tracking-tight flex items-center gap-2">
              <span>NikSpider v3.0</span>
              <span className="text-[10px] font-mono font-normal px-2 py-0.5 rounded-full bg-purple-950/70 border border-purple-500/35 text-purple-200">
                Interactive Control Surface
              </span>
            </div>
            <div className="text-[11px] text-purple-300/80 font-mono">
              Autonomous Web Security Agent
            </div>
          </div>
        </div>

        {/* Right: Active Filter Pill + Ask Spider AI Button + Scan Status Pill */}
        <div className="pointer-events-auto flex items-center gap-2">
          {selectedLegLabel && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleLegFilter(null);
              }}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono bg-purple-600/35 text-purple-100 border border-purple-400 cursor-pointer hover:bg-purple-600/50"
            >
              <Filter className="w-3 h-3" />
              <span>Leg: {selectedLegLabel}</span>
              <X className="w-3 h-3" />
            </button>
          )}

          {selectedSeverityFilter && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSelectSeverityFilter(null);
              }}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono bg-red-500/25 text-red-200 border border-red-400/60 cursor-pointer hover:bg-red-500/40"
            >
              <span>Eye: {selectedSeverityFilter}</span>
              <X className="w-3 h-3" />
            </button>
          )}

          {/* Tier 3: Ask Spider Mini-Chat Button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setChatOpen((o) => !o);
            }}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-mono font-semibold border transition cursor-pointer ${
              chatOpen
                ? 'bg-purple-600 text-white border-purple-300 shadow-[0_0_20px_rgba(168,85,247,0.6)]'
                : 'bg-[#120b24]/90 text-purple-200 border-purple-500/45 hover:border-purple-400'
            }`}
            title="Open Spider AI Mini-Chat (Stage 3.5 Gateway)"
          >
            <MessageSquare className="w-3.5 h-3.5 text-purple-300" />
            <span>Ask Spider</span>
          </button>

          {/* Status Pill: Ready to Scan / Scanning... / Paused / Scan Complete */}
          {isPaused ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowControlModal(true);
              }}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-mono font-bold bg-amber-500/20 text-amber-200 border border-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.4)] cursor-pointer"
            >
              <Pause className="w-3.5 h-3.5 text-amber-400" />
              <span>Paused ({Math.round(progressPct)}%)</span>
            </button>
          ) : isScanning ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowControlModal(true);
              }}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-mono font-bold bg-[#a855f7]/20 text-[#e9d5ff] border border-[#c084fc] shadow-[0_0_22px_rgba(168,85,247,0.55)] animate-pulse cursor-pointer"
            >
              <span className="w-2 h-2 rounded-full bg-[#c084fc] animate-ping" />
              <span>Scanning... ({Math.round(progressPct)}%)</span>
            </button>
          ) : scanComplete ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowStartModal(true);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.4)] cursor-pointer"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Scan Complete</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowStartModal(true);
              }}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-mono text-zinc-200 bg-[#120b24]/90 hover:bg-[#a855f7]/25 border border-[#a855f7]/45 transition cursor-pointer"
            >
              <span className="w-2 h-2 rounded-full bg-[#a855f7]" />
              <span>Ready to Scan</span>
            </button>
          )}
        </div>
      </div>

      {/* Tier 3: Drag-to-Retest Overlay Ring when dragging a finding over the spider */}
      {dragOverActive && (
        <div className="absolute inset-4 z-30 rounded-2xl border-2 border-dashed border-emerald-400 bg-emerald-950/40 backdrop-blur-xs flex flex-col items-center justify-center pointer-events-none">
          <RefreshCw className="w-10 h-10 text-emerald-400 animate-spin mb-2" />
          <div className="text-sm font-mono font-bold text-emerald-200 tracking-wide">
            DROP &quot;FIXED?&quot; BADGE ON SPIDER TO RUN LIVE RETEST
          </div>
          <div className="text-xs font-mono text-emerald-300/80 mt-1">
            Dispatches POST /api/v2/findings/&#123;id&#125;/retest
          </div>
        </div>
      )}

      {/* Retest Status Banner */}
      {retestBanner && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-30 px-4 py-1.5 rounded-full bg-emerald-950/90 border border-emerald-400 text-emerald-200 text-xs font-mono font-bold shadow-[0_0_25px_rgba(16,185,129,0.5)]">
          {retestBanner}
        </div>
      )}

      {/* Tier 3: Live Request Photon Conduit (travels from Spider to Right Telemetry RPS Panel) */}
      {pulseBeamKey > 0 && (
        <svg
          key={pulseBeamKey}
          viewBox="0 0 300 120"
          className="pointer-events-none absolute right-0 top-[56%] w-56 h-24 z-20 overflow-visible"
        >
          <path
            d="M 10 60 Q 140 25, 295 60"
            fill="none"
            stroke="rgba(168, 85, 247, 0.18)"
            strokeWidth="1.5"
            strokeDasharray="3 4"
          />
          <path
            d="M 10 60 Q 140 25, 295 60"
            fill="none"
            stroke="#00d9ff"
            strokeWidth="3"
            strokeLinecap="round"
            className="request-pulse-beam"
            style={{ filter: 'drop-shadow(0 0 8px #00d9ff)' }}
          />
        </svg>
      )}

      {/* Moving Spider Chassis + 8 Interactive Module Legs + 4 Severity Eyes + Embedded CLI Screen */}
      <div className={`spider-look-wrapper ${lookClass}`}>
        <div
          onClick={handleSpiderChassisClick}
          onPointerDown={handlePointerDown}
          onPointerUp={cancelLongPress}
          onPointerLeave={cancelLongPress}
          className={`spider-chassis cursor-pointer ${
            isPaused
              ? 'state-paused'
              : isScanning
              ? 'state-scanning'
              : 'state-idle'
          } ${pulseActive ? 'event-burst' : ''} ${alertFlash ? 'alert-burst' : ''}`}
        >
          <img
            src={mascotImage}
            alt="NikSpider Autonomous Cyber Spider"
            className="block w-full h-auto select-none pointer-events-none"
          />

          {/* Ambient Cyber Pedestal Ring Glow */}
          <div
            className={`pointer-events-none absolute bottom-[2%] left-1/2 -translate-x-1/2 w-[76%] h-[18%] rounded-full mix-blend-screen transition-all duration-700 ${
              isScanning && !isPaused
                ? 'shadow-[0_0_55px_rgba(0,217,255,0.7)] opacity-90'
                : 'shadow-[0_0_30px_rgba(168,85,247,0.4)] opacity-60'
            }`}
          />

          {/* Bioluminescent Face Aura & Eye Glow */}
          <div
            className={`spider-face-glow ${
              pulseActive || (isScanning && !isPaused) ? 'pulse-active' : ''
            }`}
          />
          <div
            className={`spider-eye-glow ${
              pulseActive || (isScanning && !isPaused) ? 'pulse-active' : ''
            }`}
          />

          {/* ═══════════════════════════════════════════════════════════════
              TIER 1: 4 GLOWING EYES MAPPED TO SEVERITY TIERS
              (Critical / High / Medium / Low — brightness scales with live count)
          ═══════════════════════════════════════════════════════════════ */}
          {SEVERITY_EYES.map((eye) => {
            const count = severityCounts[eye.id] || 0;
            const isSelected = selectedSeverityFilter === eye.id;
            const intensity = Math.min(1, 0.35 + count * 0.22);
            const sizePx = count > 0 ? Math.min(20, 12 + count * 1.5) : 10;
            const haloBlur = count > 0 ? Math.min(28, 10 + count * 5) : 6;

            return (
              <button
                key={eye.id}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectSeverityFilter(isSelected ? null : eye.id);
                }}
                onMouseEnter={() => setHoveredEye(eye)}
                onMouseLeave={() => setHoveredEye(null)}
                className="spider-severity-eye"
                style={{
                  top: `${eye.topPct}%`,
                  left: `${eye.leftPct}%`,
                  width: `${sizePx}px`,
                  height: `${sizePx}px`,
                  backgroundColor: eye.color,
                  opacity: isSelected ? 1 : intensity,
                  boxShadow: `0 0 ${haloBlur}px rgba(${eye.glowRgba}, ${
                    count > 0 || isSelected ? 0.95 : 0.45
                  }), 0 0 ${haloBlur * 1.6}px rgba(${eye.glowRgba}, ${
                    count > 0 || isSelected ? 0.75 : 0.2
                  })`,
                  border: isSelected ? '2px solid #ffffff' : '1px solid rgba(255,255,255,0.6)',
                }}
                aria-label={`${eye.label}: ${count} confirmed`}
              >
                {count > 0 && (
                  <span className="text-[8px] font-mono font-extrabold text-black leading-none">
                    {count}
                  </span>
                )}
              </button>
            );
          })}

          {/* ═══════════════════════════════════════════════════════════════
              TIER 1 & TIER 2: 8 INTERACTIVE PROBE-MODULE LEGS
              (Lights up when probing, flashes red on confirm, click/drag filters table)
          ═══════════════════════════════════════════════════════════════ */}
          {SPIDER_LEGS.map((leg) => {
            const { probes, confirmed, isProbing, justConfirmed, isSelected } =
              getLegStats(leg);

            let badgeBg = 'bg-[#0b0518]/85 border-purple-500/40 text-zinc-300';
            let glowShadow = '0 0 10px rgba(168, 85, 247, 0.25)';

            if (justConfirmed || confirmed > 0) {
              badgeBg = 'bg-red-950/90 border-red-400 text-red-200';
              glowShadow = '0 0 20px rgba(239, 68, 68, 0.75)';
            } else if (isProbing) {
              badgeBg = 'bg-cyan-950/90 border-cyan-300 text-cyan-200';
              glowShadow = '0 0 22px rgba(0, 217, 255, 0.85)';
            } else if (isSelected) {
              badgeBg = 'bg-purple-600/90 border-white text-white';
              glowShadow = '0 0 22px rgba(192, 132, 252, 0.9)';
            } else if (probes > 0) {
              badgeBg = 'bg-purple-950/90 border-purple-400/70 text-purple-200';
              glowShadow = '0 0 14px rgba(168, 85, 247, 0.45)';
            }

            const isHovered = hoveredLeg?.legIndex === leg.legIndex;
            const showFullPill = isSelected || isProbing || confirmed > 0 || isHovered;

            return (
              <div
                key={leg.legIndex}
                draggable
                onDragStart={(e) => {
                  e.stopPropagation();
                  onToggleLegFilter(leg);
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleLegFilter(isSelected ? null : leg);
                }}
                onMouseEnter={() => setHoveredLeg(leg)}
                onMouseLeave={() => setHoveredLeg(null)}
                className={`spider-leg-node rounded-full border font-mono text-[10px] font-bold flex items-center transition-all duration-200 ${
                  showFullPill ? 'px-2 py-0.5 gap-1.5' : 'p-1'
                } ${badgeBg} ${
                  isProbing ? 'leg-probing' : ''
                } ${justConfirmed ? 'leg-confirmed-flash' : ''}`}
                style={{
                  top: `${leg.topPct}%`,
                  left: `${leg.leftPct}%`,
                  boxShadow: glowShadow,
                }}
                title={`Leg ${leg.legIndex}: ${leg.fullName}`}
              >
                <span
                  className={`rounded-full transition-all duration-200 ${
                    showFullPill ? 'w-1.5 h-1.5' : 'w-2 h-2'
                  } ${
                    confirmed > 0
                      ? 'bg-red-400 animate-ping'
                      : isProbing
                      ? 'bg-cyan-300 animate-ping'
                      : probes > 0
                      ? 'bg-purple-300'
                      : 'bg-cyan-400/80'
                  }`}
                />
                {showFullPill && (
                  <>
                    <span>L{leg.legIndex}</span>
                    <span className="hidden sm:inline">{leg.shortLabel}</span>
                    {(probes > 0 || confirmed > 0) && (
                      <span className="text-[9px] opacity-85">
                        {confirmed > 0 ? `!${confirmed}` : probes}
                      </span>
                    )}
                  </>
                )}
              </div>
            );
          })}

          {/* Live CLI Output Rendered Directly Inside the Spider's Top Screen */}
          <div className="spider-cli-screen" aria-hidden="true">
            <div>
              {visibleCli.map((line) => (
                <div key={line.id} className={`spider-cli-line ${line.tone}`}>
                  {line.text}
                </div>
              ))}
            </div>
            <div>
              <div className="spider-cli-progress">
                <span style={{ width: `${Math.max(5, Math.min(100, progressPct))}%` }} />
              </div>
              <div className="spider-cli-line ok">
                &gt;{' '}
                {isPaused
                  ? 'scan paused — click spider to resume_'
                  : isScanning
                  ? `probing ${activeProbingModule || 'surface'}...`
                  : scanComplete
                  ? 'triage complete ✓'
                  : 'click spider to configure & start_'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Hover Tooltip for Leg or Eye */}
      {(hoveredLeg || hoveredEye) && (
        <div className="pointer-events-none absolute bottom-14 left-1/2 -translate-x-1/2 z-30 px-3.5 py-2 rounded-xl bg-[#07030f]/95 border border-purple-400/60 shadow-[0_0_28px_rgba(168,85,247,0.5)] font-mono text-xs text-white whitespace-nowrap">
          {hoveredLeg ? (
            (() => {
              const st = getLegStats(hoveredLeg);
              return (
                <div className="flex items-center gap-2">
                  <span className="text-purple-300 font-bold">
                    Leg {hoveredLeg.legIndex} — {hoveredLeg.fullName}
                  </span>
                  <span className="text-zinc-400">—</span>
                  <span className="text-cyan-300">{st.probes} probes sent</span>
                  <span className="text-zinc-400">,</span>
                  <span
                    className={
                      st.confirmed > 0 ? 'text-red-400 font-bold' : 'text-emerald-300'
                    }
                  >
                    {st.confirmed} confirmed
                  </span>
                  <span className="text-[10px] text-zinc-400">(Click to filter)</span>
                </div>
              );
            })()
          ) : hoveredEye ? (
            <div className="flex items-center gap-2">
              <span style={{ color: hoveredEye.color }} className="font-bold">
                ● {hoveredEye.label}
              </span>
              <span>—</span>
              <span className="text-white font-bold">
                {severityCounts[hoveredEye.id]} confirmed finding(s)
              </span>
              <span className="text-[10px] text-zinc-400">(Click eye to filter)</span>
            </div>
          ) : null}
        </div>
      )}

      {/* Platform Base Progress Ring Overlay (Real % Complete) */}
      {(isScanning || isPaused || scanComplete) && (
        <div className="absolute bottom-11 left-1/2 -translate-x-1/2 w-[66%] pointer-events-none">
          <div className="h-1.5 w-full rounded-full bg-[#1a0f30]/90 border border-[#a855f7]/35 overflow-hidden shadow-[0_0_16px_rgba(168,85,247,0.4)]">
            <div
              className="h-full bg-gradient-to-r from-[#a855f7] via-[#c084fc] to-[#00d9ff] transition-all duration-300"
              style={{ width: `${Math.max(4, Math.min(100, progressPct))}%` }}
            />
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          TIER 1: CLICK-WHILE-IDLE -> "START SCAN" MODAL
      ═══════════════════════════════════════════════════════════════════ */}
      {showStartModal && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute inset-0 z-30 bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
        >
          <div className="w-full max-w-md rounded-2xl bg-[#090514] border border-purple-400/60 p-5 shadow-[0_0_45px_rgba(168,85,247,0.45)] space-y-4">
            <div className="flex items-center justify-between border-b border-purple-500/25 pb-3">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Play className="w-4 h-4 text-purple-400 fill-purple-400" />
                  <span>Start Autonomous Security Scan</span>
                </h3>
                <p className="text-[11px] text-zinc-400 font-mono mt-0.5">
                  Select scan intensity profile to deploy spider probes
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowStartModal(false)}
                className="text-zinc-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              {(['safe', 'standard', 'aggressive'] as const).map((profId) => {
                const p = PROFILES[profId];
                const active = activeProfile === profId;
                return (
                  <button
                    key={profId}
                    type="button"
                    onClick={() => onChangeProfile(profId)}
                    className={`w-full p-3 rounded-xl border text-left transition cursor-pointer ${
                      active
                        ? 'bg-purple-600/25 border-purple-400 shadow-[0_0_16px_rgba(168,85,247,0.3)]'
                        : 'bg-black/60 border-purple-500/20 hover:border-purple-500/45'
                    }`}
                  >
                    <div className="flex items-center justify-between font-mono text-xs">
                      <span className="font-bold text-white uppercase">{p.label}</span>
                      <span className="text-purple-300">
                        {p.moduleCount} Modules · {p.budget}
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-400 mt-1">{p.description}</p>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowStartModal(false)}
                className="px-3.5 py-2 rounded-xl bg-black border border-purple-500/30 text-xs font-mono text-zinc-300 hover:text-white cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowStartModal(false);
                  onQuickStartScan(activeProfile);
                }}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#a855f7] to-[#7e22ce] hover:from-[#c084fc] hover:to-[#9333ea] text-xs font-mono font-bold text-white shadow-[0_0_22px_rgba(168,85,247,0.55)] flex items-center gap-1.5 cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Start Scan ({activeProfile.toUpperCase()})</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          TIER 1: CLICK-MID-SCAN -> PAUSE / RESUME / STOP CONTROL MODAL
      ═══════════════════════════════════════════════════════════════════ */}
      {showControlModal && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute inset-0 z-30 bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
        >
          <div className="w-full max-w-sm rounded-2xl bg-[#090514] border border-purple-400/60 p-5 shadow-[0_0_45px_rgba(168,85,247,0.45)] space-y-4 font-mono">
            <div className="flex items-center justify-between border-b border-purple-500/25 pb-2.5">
              <span className="text-xs font-bold text-purple-300 uppercase">
                Active Scan Orchestrator Control
              </span>
              <button
                type="button"
                onClick={() => setShowControlModal(false)}
                className="text-zinc-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 rounded-xl bg-black/60 border border-purple-500/20">
                <div className="text-[10px] text-zinc-400">Pipeline Stage</div>
                <div className="text-white font-bold mt-0.5">Stage {currentStage} / 6</div>
              </div>
              <div className="p-2.5 rounded-xl bg-black/60 border border-purple-500/20">
                <div className="text-[10px] text-zinc-400">Requests / Elapsed</div>
                <div className="text-purple-300 font-bold mt-0.5">
                  {requestsSent} reqs · {elapsedFormatted}
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              {isPaused ? (
                <button
                  type="button"
                  onClick={async () => {
                    await onControlScan('resume');
                    setShowControlModal(false);
                  }}
                  className="w-full py-2.5 rounded-xl bg-emerald-600/30 hover:bg-emerald-600/45 border border-emerald-400 text-xs font-bold text-emerald-200 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Resume Scan</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={async () => {
                    await onControlScan('pause');
                    setShowControlModal(false);
                  }}
                  className="w-full py-2.5 rounded-xl bg-amber-500/25 hover:bg-amber-500/40 border border-amber-400 text-xs font-bold text-amber-200 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Pause className="w-3.5 h-3.5" />
                  <span>Pause Scan Between Probes</span>
                </button>
              )}

              <button
                type="button"
                onClick={async () => {
                  await onControlScan('stop');
                  setShowControlModal(false);
                }}
                className="w-full py-2.5 rounded-xl bg-red-600/25 hover:bg-red-600/45 border border-red-400 text-xs font-bold text-red-200 flex items-center justify-center gap-2 cursor-pointer"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
                <span>Stop Scan Immediately</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          TIER 1: RIGHT-CLICK / LONG-PRESS QUICK MENU
      ═══════════════════════════════════════════════════════════════════ */}
      {contextMenu && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{ top: contextMenu.y, left: contextMenu.x }}
          className="absolute z-40 w-60 rounded-2xl bg-[#090514]/95 backdrop-blur-xl border border-purple-400/60 p-2 shadow-[0_0_36px_rgba(168,85,247,0.5)] font-mono text-xs space-y-1"
        >
          <div className="px-2.5 py-1 text-[10px] uppercase tracking-wider text-purple-300 border-b border-purple-500/20 flex items-center justify-between">
            <span>Spider Quick Actions</span>
            <button
              type="button"
              onClick={() => setContextMenu(null)}
              className="text-zinc-400 hover:text-white cursor-pointer"
            >
              <X className="w-3 h-3" />
            </button>
          </div>

          <button
            type="button"
            onClick={() => setShowLastFiveInMenu((v) => !v)}
            className="w-full px-2.5 py-2 rounded-lg hover:bg-purple-500/20 text-left text-zinc-100 flex items-center justify-between cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
              <span>View Last 5 Findings</span>
            </span>
            <span className="text-[10px] text-purple-300">{confirmedFindings.length}</span>
          </button>

          {showLastFiveInMenu && (
            <div className="pl-2 pr-1 py-1 space-y-1 max-h-32 overflow-y-auto border-l border-purple-500/30 ml-2">
              {confirmedFindings.length === 0 ? (
                <div className="text-[10px] text-zinc-500 py-1">No confirmed findings yet.</div>
              ) : (
                confirmedFindings.slice(0, 5).map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => {
                      setContextMenu(null);
                      onSelectFinding(f.id);
                    }}
                    className="w-full text-left text-[10px] p-1 rounded hover:bg-purple-500/20 text-zinc-200 truncate cursor-pointer"
                  >
                    [{f.severity}] {f.module} — {f.url}
                  </button>
                ))
              )}
            </div>
          )}

          <button
            type="button"
            onClick={() => {
              setContextMenu(null);
              setChatOpen(true);
            }}
            className="w-full px-2.5 py-2 rounded-lg hover:bg-purple-500/20 text-left text-zinc-100 flex items-center gap-2 cursor-pointer"
          >
            <MessageSquare className="w-3.5 h-3.5 text-purple-400" />
            <span>Ask Spider AI Assistant</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setContextMenu(null);
              onJumpToTerminal();
            }}
            className="w-full px-2.5 py-2 rounded-lg hover:bg-purple-500/20 text-left text-zinc-100 flex items-center gap-2 cursor-pointer"
          >
            <Terminal className="w-3.5 h-3.5 text-cyan-400" />
            <span>Jump to Command Terminal</span>
          </button>

          {activeScanId && (
            <a
              href={`/api/v2/scans/${activeScanId}/roadmap`}
              target="_blank"
              rel="noreferrer"
              onClick={() => setContextMenu(null)}
              className="w-full px-2.5 py-2 rounded-lg hover:bg-purple-500/20 text-left text-zinc-100 flex items-center gap-2 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span>Export Current Report (JSON)</span>
            </a>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          TIER 3: ANCHORED SPIDER MINI-CHAT SPEECH-BUBBLE POPOVER
          (Calls Stage 3.5 Gateway with current scan's findings as context)
      ═══════════════════════════════════════════════════════════════════ */}
      {chatOpen && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute top-14 right-4 z-30 w-80 rounded-2xl bg-[#090514]/95 backdrop-blur-xl border border-[#c084fc]/65 p-3.5 shadow-[0_0_42px_rgba(168,85,247,0.5)] flex flex-col gap-2.5"
        >
          <div className="flex items-center justify-between border-b border-purple-500/25 pb-2">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-mono font-bold text-purple-200">
                Spider AI Analyst (Stage 3.5)
              </span>
            </div>
            <button
              type="button"
              onClick={() => setChatOpen(false)}
              className="text-zinc-400 hover:text-white cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Quick-ask prompt chips */}
          <div className="flex flex-wrap gap-1">
            {[
              "What's my riskiest endpoint?",
              'What should I fix first?',
              'Summarize findings',
            ].map((chip) => (
              <button
                key={chip}
                type="button"
                onClick={() => handleAskSpider(chip)}
                className="px-2 py-0.5 rounded-full bg-purple-950/70 hover:bg-purple-800/60 border border-purple-500/35 text-[10px] font-mono text-purple-200 cursor-pointer transition"
              >
                {chip}
              </button>
            ))}
          </div>

          {/* Speech-bubble conversation history */}
          <div className="max-h-44 overflow-y-auto space-y-2 pr-1 text-xs font-mono">
            {chatHistory.map((msg) => (
              <div
                key={msg.id}
                className={`p-2 rounded-xl leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-purple-600/30 border border-purple-400/40 text-white ml-6'
                    : 'bg-black/70 border border-purple-500/30 text-purple-100 mr-2'
                }`}
              >
                {msg.text}
              </div>
            ))}
            {chatLoading && (
              <div className="p-2 rounded-xl bg-black/70 border border-purple-500/30 text-purple-300 flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Synthesizing grounded answer...</span>
              </div>
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleAskSpider();
            }}
            className="flex items-center gap-1.5 pt-1"
          >
            <input
              type="text"
              value={chatQuestion}
              onChange={(e) => setChatQuestion(e.target.value)}
              placeholder="Ask about findings or endpoints..."
              className="flex-1 bg-black/80 border border-purple-500/35 rounded-lg px-2.5 py-1.5 text-xs font-mono text-white outline-none focus:border-purple-400"
            />
            <button
              type="submit"
              disabled={chatLoading || !chatQuestion.trim()}
              className="p-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      )}

      {/* Bottom Footer Bar: Scan · Analyze · Secure + Quick Profile & Start/Pause Button */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="absolute bottom-3 left-5 right-5 z-20 flex flex-wrap items-center justify-between gap-2"
      >
        <div className="flex items-center gap-2 text-xs font-mono text-zinc-300">
          <span className="inline-flex gap-0.5 text-[#a855f7] font-extrabold">////</span>
          <span>Scan · Analyze · Secure</span>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center bg-[#090514]/90 border border-[#a855f7]/35 rounded-lg p-0.5 text-[10px] font-mono">
            {(['safe', 'standard', 'aggressive'] as const).map((prof) => (
              <button
                key={prof}
                type="button"
                disabled={isScanning}
                onClick={() => onChangeProfile(prof)}
                className={`px-2 py-1 rounded uppercase transition cursor-pointer ${
                  activeProfile === prof
                    ? 'bg-[#a855f7] text-white font-bold'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                {prof}
              </button>
            ))}
          </div>

          <button
            type="button"
            disabled={isScanning && !isPaused}
            onClick={() => onQuickStartScan(activeProfile)}
            className="px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-[#a855f7] to-[#7e22ce] hover:from-[#c084fc] hover:to-[#9333ea] disabled:opacity-40 text-white font-mono text-xs font-bold shadow-[0_0_18px_rgba(168,85,247,0.5)] flex items-center gap-1.5 transition cursor-pointer"
          >
            <Play className="w-3 h-3 fill-current" />
            <span>{isScanning ? 'Scanning...' : 'Launch Scan'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default SpiderStatusHero;
