import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Target, ScanProfile, Severity, TriageResult } from './types';
import HomeVerifyGate from './components/HomeVerifyGate';
import { CommandSidebar, ToolSection } from './components/CommandSidebar';
import { StepRail } from './components/StepRail';
import { CommandKpiCards } from './components/CommandKpiCards';
import { ScanStartPanel } from './components/ScanStartPanel';
import { StepEndpointsView } from './components/StepEndpointsView';
import { StepLiveProbesView } from './components/StepLiveProbesView';
import { StepAgentDebaterView } from './components/StepAgentDebaterView';
import { StepRoadmapView } from './components/StepRoadmapView';
import { StepRetestVerifyView } from './components/StepRetestVerifyView';
import { CommandTerminalPanel } from './components/CommandTerminalPanel';
import { StepToastBanner } from './components/StepToastBanner';
import {
  SpiderStatusHero,
  SpiderCliLine,
  LegModuleCluster,
} from './components/SpiderStatusHero';
import { LiveTelemetryPanel } from './components/LiveTelemetryPanel';
import { useScanStream } from './hooks/useScanStream';
import { useScanStore, scanStore } from './store/scanStore';
import { StepId } from './config/steps';
import { startScan, controlScan, retestFindingDetailed, getRoadmap } from './api/client';
import {
  Search,
  Bell,
  Maximize2,
  Minimize2,
  SunMoon,
  ShieldCheck,
  Loader2,
  X,
  Activity,
  Settings,
  HelpCircle,
  Play,
  RotateCcw,
  Sparkles,
} from 'lucide-react';

export function App() {
  // ═══════════════════════════════════════════════════════════════════
  // STAGE 0 OWNERSHIP VERIFICATION GATE
  // ═══════════════════════════════════════════════════════════════════
  const [verifiedTarget, setVerifiedTarget] = useState<Target | null>(() => {
    try {
      const saved = sessionStorage.getItem('nikspider_scan_session');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.targetId && parsed.targetUrl) {
          return {
            id: parsed.targetId,
            url: parsed.targetUrl,
            token: '',
            verified: true,
          };
        }
      }
    } catch {}
    return null;
  });

  // Active Tool selection (Terminal, Activity Logs, Settings, Help) vs Step View
  const [activeTool, setActiveTool] = useState<ToolSection | null>(null);

  // Search Palette state (Ctrl + K)
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // UI state
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [highGlowMode, setHighGlowMode] = useState(true);
  const [isPaused, setIsPaused] = useState(false);

  // Hook handles SSE connection, exponential backoff, duration timer & hash sync
  const { recheckHealth } = useScanStream();

  // Read reactive store values
  const currentStep = useScanStore((s) => s.currentStep);
  const furthestStep = useScanStore((s) => s.furthestStep);
  const scanStatus = useScanStore((s) => s.scanStatus);
  const sseStatus = useScanStore((s) => s.sseStatus);
  const backendOnline = useScanStore((s) => s.backendOnline);
  const scanId = useScanStore((s) => s.scanId);
  const targetId = useScanStore((s) => s.targetId);
  const profile = useScanStore((s) => s.profile);
  const endpoints = useScanStore((s) => s.endpoints);
  const crawl = useScanStore((s) => s.crawl);
  const plan = useScanStore((s) => s.plan);
  const rawFlags = useScanStore((s) => s.rawFlags);
  const verdicts = useScanStore((s) => s.verdicts);
  const requests = useScanStore((s) => s.requests);
  const kpis = useScanStore((s) => s.kpis);

  // Spider Status Hero state
  const [eventPulseTick, setEventPulseTick] = useState(0);
  const [confirmedFlashTick, setConfirmedFlashTick] = useState(0);
  const [selectedLegFilter, setSelectedLegFilter] = useState<LegModuleCluster | null>(null);
  const [selectedSeverityFilter, setSelectedSeverityFilter] = useState<Severity | null>(null);
  const [spiderCliLines, setSpiderCliLines] = useState<SpiderCliLine[]>([
    { id: '1', text: 'NikSpider engine online. Target scope verified.', tone: 'ok' },
    { id: '2', text: 'Waiting for command. Select policy or start scan.', tone: 'violet' },
  ]);

  // Sync verifiedTarget into scanStore
  useEffect(() => {
    if (verifiedTarget?.verified) {
      scanStore.dispatch({
        type: 'SET_TARGET',
        payload: { targetId: verifiedTarget.id, targetUrl: verifiedTarget.url },
      });
    }
  }, [verifiedTarget]);

  // Push updates to spider CLI lines on scan changes
  useEffect(() => {
    setEventPulseTick((t) => t + 1);
  }, [crawl.pages, rawFlags.length, verdicts.length, requests.length]);

  useEffect(() => {
    if (verdicts.length > 0) {
      const last = verdicts[verdicts.length - 1];
      if (last.verdict === 'confirmed') {
        setConfirmedFlashTick((t) => t + 1);
        setSpiderCliLines((prev) => [
          ...prev.slice(-8),
          {
            id: `cli-${Date.now()}`,
            text: `✓ CONFIRMED: [${last.severity}] ${last.module || last.owasp}`,
            tone: 'warn',
          },
        ]);
      }
    }
  }, [verdicts.length]);

  // Calculate module probe counts for the 8 spider legs
  const moduleProbeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const f of rawFlags) {
      counts[f.module] = (counts[f.module] || 0) + 1;
    }
    for (const v of verdicts) {
      if (v.module) counts[v.module] = (counts[v.module] || 0) + 1;
    }
    for (const r of requests) {
      const lower = r.url.toLowerCase();
      if (lower.includes('search') || lower.includes('select')) counts['sqli'] = (counts['sqli'] || 0) + 1;
      if (lower.includes('comment') || lower.includes('input')) counts['xss'] = (counts['xss'] || 0) + 1;
      if (lower.includes('fetch') || lower.includes('proxy')) counts['ssrf'] = (counts['ssrf'] || 0) + 1;
      if (lower.includes('auth') || lower.includes('login') || lower.includes('token')) counts['session'] = (counts['session'] || 0) + 1;
    }
    return counts;
  }, [rawFlags, verdicts, requests]);

  const activeProbingModule = useMemo(() => {
    if (rawFlags.length > 0) return rawFlags[rawFlags.length - 1].module;
    return null;
  }, [rawFlags]);

  const lastConfirmedModule = useMemo(() => {
    const conf = verdicts.filter((v) => v.verdict === 'confirmed');
    if (conf.length > 0) return conf[conf.length - 1].module || null;
    return null;
  }, [verdicts]);

  // Format duration into MM:SS
  const elapsedFormatted = useMemo(() => {
    const sec = kpis.durationSec ?? 0;
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }, [kpis.durationSec]);

  // Global Ctrl + K search hotkey
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
      if (e.key === 'Escape') {
        setSearchOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  // Spider control actions
  const handleControlScan = async (action: 'pause' | 'resume' | 'stop') => {
    if (!scanId) return;
    try {
      await controlScan(scanId, action);
      if (action === 'pause') {
        setIsPaused(true);
        setSpiderCliLines((prev) => [
          ...prev.slice(-8),
          { id: `c-${Date.now()}`, text: '⏸ Scan paused by user.', tone: 'warn' },
        ]);
      } else if (action === 'resume') {
        setIsPaused(false);
        setSpiderCliLines((prev) => [
          ...prev.slice(-8),
          { id: `c-${Date.now()}`, text: '▶ Scan resumed.', tone: 'ok' },
        ]);
      } else if (action === 'stop') {
        setIsPaused(false);
        scanStore.dispatch({ type: 'START_SCAN_ERROR', payload: 'Scan stopped by user' });
        setSpiderCliLines((prev) => [
          ...prev.slice(-8),
          { id: `c-${Date.now()}`, text: '⏹ Scan stopped by operator.', tone: 'warn' },
        ]);
      }
    } catch (e) {
      console.error('Failed to control scan', e);
    }
  };

  const handleQuickStartScan = async (selectedProf?: ScanProfile) => {
    const profToUse = selectedProf || profile;
    if (selectedProf) {
      scanStore.dispatch({ type: 'SET_PROFILE', payload: selectedProf });
    }
    if (!targetId) return;

    scanStore.dispatch({ type: 'START_SCAN_REQUEST' });
    try {
      const newScanId = await startScan(targetId, profToUse);
      scanStore.dispatch({ type: 'START_SCAN_SUCCESS', payload: { scanId: newScanId } });
      setSpiderCliLines((prev) => [
        ...prev.slice(-8),
        { id: `s-${Date.now()}`, text: `✓ Scan ${newScanId.slice(0, 8)} started in [${profToUse.toUpperCase()}] profile.`, tone: 'ok' },
      ]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to start scan';
      scanStore.dispatch({ type: 'START_SCAN_ERROR', payload: msg });
    }
  };

  const handleRetestFinding = async (findingId: string) => {
    try {
      const res = await retestFindingDetailed(findingId);
      scanStore.dispatch({
        type: 'RETEST_RESULT',
        payload: {
          findingId,
          passed: res.passed,
          status: res.status,
          message: res.message,
          score: res.score,
        },
      });
      if (scanId) {
        const fresh = await getRoadmap(scanId);
        if (fresh) scanStore.dispatch({ type: 'SET_ROADMAP', payload: fresh });
      }
    } catch (e) {
      console.error('Retest error', e);
    }
  };

  // Filtered search items
  const matchedVerdicts = verdicts.filter(
    (v) =>
      v.module?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.url?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.owasp?.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const matchedEndpoints = endpoints.filter((ep) =>
    ep.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // ═══════════════════════════════════════════════════════════════════
  // STRICT OWNERSHIP GATE: Renders TargetScreen pre-verification
  // ═══════════════════════════════════════════════════════════════════
  if (!verifiedTarget || !verifiedTarget.verified) {
    return (
      <HomeVerifyGate
        onVerified={(target: Target, chosenProfile?: ScanProfile) => {
          setVerifiedTarget(target);
          scanStore.dispatch({
            type: 'SET_TARGET',
            payload: { targetId: target.id, targetUrl: target.url },
          });
          if (chosenProfile) {
            scanStore.dispatch({ type: 'SET_PROFILE', payload: chosenProfile });
          }
        }}
      />
    );
  }

  const progressPct =
    scanStatus === 'completed'
      ? 100
      : Math.min(100, Math.round(((currentStep - 1) / 5) * 100));

  return (
    <div
      className={`min-h-screen bg-[#000000] text-white flex select-none sm:select-auto overflow-x-hidden ${
        highGlowMode ? '' : 'opacity-95'
      }`}
    >
      {/* Central Ambient Radial Background Glow */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background: highGlowMode
            ? 'radial-gradient(circle at 48% 38%, rgba(168, 85, 247, 0.12) 0%, rgba(15, 5, 29, 0.4) 45%, rgba(0, 0, 0, 1) 85%)'
            : 'none',
        }}
      />

      {/* ═══════════════════════════════════════════════════════════════════
          1. SIDEBAR (Numbered Badges 1..6 + Tools Group)
      ═══════════════════════════════════════════════════════════════════ */}
      <CommandSidebar
        activeTool={activeTool}
        onSelectTool={(tool) => setActiveTool(tool)}
        onSelectStep={(stepId: StepId) => {
          setActiveTool(null);
          scanStore.dispatch({ type: 'GO_TO_STEP', payload: stepId });
        }}
      />

      {/* ═══════════════════════════════════════════════════════════════════
          MAIN WORKSPACE
      ═══════════════════════════════════════════════════════════════════ */}
      <div className="relative z-10 flex-1 flex flex-col min-w-0">
        {/* ═══════════════════════════════════════════════════════════════════
            TOP BAR
        ═══════════════════════════════════════════════════════════════════ */}
        <header className="h-14 border-b border-purple-500/25 bg-[#05020a]/85 backdrop-blur-xl px-5 flex items-center justify-between gap-4 sticky top-0 z-30">
          {/* Global Search Trigger (Ctrl + K) */}
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="w-full max-w-md flex items-center justify-between px-3.5 py-1.5 rounded-xl bg-[#090412] border border-purple-500/35 hover:border-purple-400/60 text-xs text-zinc-400 transition cursor-pointer shadow-[0_0_16px_rgba(168,85,247,0.1)]"
          >
            <div className="flex items-center gap-2.5">
              <Search className="w-3.5 h-3.5 text-purple-400" />
              <span>Search findings or endpoints... (Ctrl + K)</span>
            </div>
            <kbd className="px-1.5 py-0.5 rounded bg-purple-950/60 border border-purple-500/30 text-[10px] font-mono text-purple-300">
              Ctrl+K
            </kbd>
          </button>

          {/* Right Status Badges & Controls */}
          <div className="flex items-center gap-3">
            {/* SSE Reconnecting Chip */}
            {sseStatus === 'reconnecting' && (
              <div
                className="px-3 py-1 rounded-full bg-amber-950/60 border border-amber-400/50 text-xs font-mono text-amber-300 flex items-center gap-1.5 animate-pulse shadow-[0_0_16px_rgba(245,158,11,0.25)]"
                title="Stream reconnecting with exponential backoff"
              >
                <Loader2 className="w-3 h-3 animate-spin text-amber-400" />
                <span>Reconnecting…</span>
              </div>
            )}

            {/* Backend Engine Health Pill */}
            <div
              className={`px-3 py-1 rounded-full border text-xs font-mono font-semibold flex items-center gap-2 ${
                backendOnline
                  ? 'bg-emerald-950/40 border-emerald-500/45 text-emerald-300 shadow-[0_0_16px_rgba(34,197,94,0.2)]'
                  : 'bg-red-950/40 border-red-500/45 text-red-300 shadow-[0_0_20px_rgba(239,68,68,0.3)]'
              }`}
              title={backendOnline ? 'Engine Online (/api/v2)' : 'Engine Unreachable'}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  backendOnline ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'
                }`}
              />
              <span>{backendOnline ? 'Engine Online' : 'Engine Offline'}</span>
              {!backendOnline && (
                <button
                  type="button"
                  onClick={recheckHealth}
                  className="ml-1 px-1.5 py-0.5 rounded bg-red-900/80 hover:bg-red-800 text-[10px] text-white cursor-pointer"
                >
                  Retry
                </button>
              )}
            </div>

            {/* Demo Environment Badge */}
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-950/50 border border-purple-400/40 text-xs font-mono text-purple-200 shadow-[0_0_14px_rgba(168,85,247,0.2)]">
              <ShieldCheck className="w-3.5 h-3.5 text-purple-400" />
              <span>Demo Environment</span>
            </div>

            {/* Fullscreen Toggle */}
            <button
              type="button"
              onClick={toggleFullscreen}
              className="p-2 rounded-xl bg-[#090412] border border-purple-500/30 hover:border-purple-400/60 text-zinc-300 hover:text-white transition cursor-pointer"
              title="Toggle Fullscreen"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>

            {/* Theme / Neon Glow Toggle */}
            <button
              type="button"
              onClick={() => setHighGlowMode((g) => !g)}
              className="p-2 rounded-xl bg-[#090412] border border-purple-500/30 hover:border-purple-400/60 text-purple-300 hover:text-white transition cursor-pointer"
              title="Toggle Neon Glow"
            >
              <SunMoon className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* ═══════════════════════════════════════════════════════════════════
            MAIN CONTENT AREA
        ═══════════════════════════════════════════════════════════════════ */}
        <main className="p-4 sm:p-6 flex-1 space-y-5 max-w-7xl mx-auto w-full">
          {/* 2. STEP RAIL */}
          <StepRail
            onSelectStep={(stepId) => {
              setActiveTool(null);
              scanStore.dispatch({ type: 'GO_TO_STEP', payload: stepId });
            }}
          />

          {/* 4. KPI CARDS */}
          <CommandKpiCards />

          {/* ═══════════════════════════════════════════════════════════════════
              UPPER COCKPIT: INTERACTIVE SPIDER HERO CONTROL SURFACE (7 COLS)
              + COMPACT TERMINAL / TELEMETRY (5 COLS)
          ═══════════════════════════════════════════════════════════════════ */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div className="lg:col-span-7">
              <SpiderStatusHero
                activeScanId={scanId}
                isScanning={scanStatus === 'running'}
                isPaused={isPaused}
                scanComplete={scanStatus === 'completed'}
                progressPct={progressPct}
                eventPulseTick={eventPulseTick}
                confirmedFlashTick={confirmedFlashTick}
                cliLines={spiderCliLines}
                currentStage={currentStep}
                requestsSent={requests.length}
                elapsedFormatted={elapsedFormatted}
                activeProfile={profile}
                onChangeProfile={(p) => scanStore.dispatch({ type: 'SET_PROFILE', payload: p })}
                onQuickStartScan={handleQuickStartScan}
                onControlScan={handleControlScan}
                moduleProbeCounts={moduleProbeCounts}
                activeProbingModule={activeProbingModule}
                lastConfirmedModule={lastConfirmedModule}
                findings={verdicts}
                selectedModuleFilter={selectedLegFilter?.modules || null}
                selectedLegLabel={
                  selectedLegFilter ? `L${selectedLegFilter.legIndex} ${selectedLegFilter.shortLabel}` : null
                }
                onToggleLegFilter={setSelectedLegFilter}
                selectedSeverityFilter={selectedSeverityFilter}
                onSelectSeverityFilter={setSelectedSeverityFilter}
                lookDirection="none"
                onJumpToTerminal={() => setActiveTool('terminal')}
                onSelectFinding={() => {
                  scanStore.dispatch({ type: 'GO_TO_STEP', payload: 4 });
                }}
                onDropRetestFinding={handleRetestFinding}
              />
            </div>

            <div className="lg:col-span-5 space-y-3.5 flex flex-col justify-between">
              <div className="flex-1">
                <CommandTerminalPanel />
              </div>

              <LiveTelemetryPanel
                pagesCrawled={crawl.pages}
                crawlQueue={crawl.queue}
                endpointsMapped={kpis.endpoints}
                checksDone={verdicts.length}
                profileId={profile}
                requestsPerSecond={scanStatus === 'running' && !isPaused ? 4 : 0}
                scanStatus={scanStatus}
              />
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════════════════════
              LOWER COCKPIT: ACTIVE 6-STEP VIEW / REPORT OR ACTIVE TOOL
          ═══════════════════════════════════════════════════════════════════ */}
          {activeTool === 'terminal' && (
            <div className="h-[560px]">
              <CommandTerminalPanel
                expanded
                onClose={() => setActiveTool(null)}
              />
            </div>
          )}

          {activeTool === 'activity_logs' && (
            <div className="p-5 rounded-2xl bg-black/85 border border-purple-500/30 space-y-4 text-left font-mono">
              <div className="flex items-center justify-between pb-3 border-b border-purple-500/20">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-purple-400" />
                  <h3 className="text-base font-bold text-white">Full HTTP Activity Logs</h3>
                  <span className="text-xs text-zinc-400">({requests.length} Requests)</span>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTool(null)}
                  className="text-xs text-purple-300 hover:text-white cursor-pointer"
                >
                  Back to Steps →
                </button>
              </div>

              <div className="max-h-[500px] overflow-y-auto space-y-2 text-xs">
                {requests.length === 0 ? (
                  <div className="p-12 text-center text-zinc-500">
                    No HTTP requests recorded yet. Start scan on Step 1.
                  </div>
                ) : (
                  requests.map((r, i) => (
                    <div
                      key={r.id || i}
                      className="p-3 rounded-xl bg-black/60 border border-zinc-800 flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <span className="text-zinc-500 text-[11px]">{r.ts ? r.ts.slice(11, 19) : ''}</span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-950 text-purple-300">
                          {r.method}
                        </span>
                        <span className="text-zinc-200 truncate">{r.url}</span>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          r.status && r.status >= 500
                            ? 'bg-red-950 text-red-300'
                            : r.status && r.status >= 400
                            ? 'bg-amber-950 text-amber-300'
                            : 'bg-emerald-950 text-emerald-300'
                        }`}
                      >
                        {r.status || '200'}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {activeTool === 'settings' && (
            <div className="p-6 rounded-2xl bg-black/85 border border-purple-500/30 space-y-5 text-left font-mono">
              <div className="flex items-center justify-between pb-3 border-b border-purple-500/20">
                <div className="flex items-center gap-2">
                  <Settings className="w-4 h-4 text-purple-400" />
                  <h3 className="text-base font-bold text-white">Platform Settings & Orchestrator</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTool(null)}
                  className="text-xs text-purple-300 hover:text-white cursor-pointer"
                >
                  Back to Steps →
                </button>
              </div>

              <div className="space-y-4 text-xs font-sans">
                <div className="p-4 rounded-xl bg-purple-950/20 border border-purple-500/20 space-y-1">
                  <span className="font-bold text-white font-mono">Safety & Intake Guard</span>
                  <p className="text-zinc-300">
                    SSRF protection active. Non-routable and metadata IPs are strictly guarded unless DEMO_MODE is set.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-purple-950/20 border border-purple-500/20 space-y-1">
                  <span className="font-bold text-white font-mono">Multi-Agent Debate Protocol</span>
                  <p className="text-zinc-300">
                    Stage 4 employs 2 independent agents with deterministic evidence validation to eliminate false alarms.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-purple-950/20 border border-purple-500/20 space-y-1">
                  <span className="font-bold text-white font-mono">Close The Loop Retesting</span>
                  <p className="text-zinc-300">
                    Remediation verification executes live targeted probes against endpoints and recalculates risk posture dynamically.
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTool === 'help_docs' && (
            <div className="p-6 rounded-2xl bg-black/85 border border-purple-500/30 space-y-5 text-left font-mono">
              <div className="flex items-center justify-between pb-3 border-b border-purple-500/20">
                <div className="flex items-center gap-2">
                  <HelpCircle className="w-4 h-4 text-purple-400" />
                  <h3 className="text-base font-bold text-white">NikSpider 6-Step Workflow Guide</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTool(null)}
                  className="text-xs text-purple-300 hover:text-white cursor-pointer"
                >
                  Back to Steps →
                </button>
              </div>

              <div className="space-y-3 text-xs font-sans text-zinc-300">
                <p>
                  NikSpider guides you through an end-to-end security cycle in 6 automated, verifiable stages:
                </p>
                <ol className="list-decimal list-inside space-y-2 font-mono text-xs">
                  <li>
                    <span className="text-purple-300 font-bold">Step 1 — Scan Center:</span> Choose Safe (50 reqs), Standard (500 reqs), or Aggressive (2000 reqs) and launch scan.
                  </li>
                  <li>
                    <span className="text-purple-300 font-bold">Step 2 — Endpoints:</span> View discovered pages, parameters, and attack surface.
                  </li>
                  <li>
                    <span className="text-purple-300 font-bold">Step 3 — Live Probes:</span> Review executed test plan, raw anomaly signals, and request audit logs.
                  </li>
                  <li>
                    <span className="text-purple-300 font-bold">Step 4 — Agent Debater:</span> Inspect validated findings filtered through adversarial debate.
                  </li>
                  <li>
                    <span className="text-purple-300 font-bold">Step 5 — Roadmap Creator:</span> Deduplicated root-cause fix graph and AI fix prompt generator.
                  </li>
                  <li>
                    <span className="text-purple-300 font-bold">Step 6 — Retest & Verify:</span> 1-click retest to prove patches on target and drive risk to zero.
                  </li>
                </ol>
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════════
              STEP VIEWS (1..6)
          ═══════════════════════════════════════════════════════════════════ */}
          {activeTool === null && (
            <div className="pt-2">
              {currentStep === 1 && <ScanStartPanel />}
              {currentStep === 2 && <StepEndpointsView />}
              {currentStep === 3 && <StepLiveProbesView />}
              {currentStep === 4 && <StepAgentDebaterView />}
              {currentStep === 5 && <StepRoadmapView />}
              {currentStep === 6 && <StepRetestVerifyView />}
            </div>
          )}
        </main>
      </div>

      {/* Floating Auto-Advance / Non-blocking Toast Banner */}
      <StepToastBanner />

      {/* ═══════════════════════════════════════════════════════════════════
          GLOBAL SEARCH PALETTE (Ctrl + K)
      ═══════════════════════════════════════════════════════════════════ */}
      {searchOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-start justify-center pt-20 px-4">
          <div className="w-full max-w-xl rounded-2xl border border-purple-500/50 bg-[#080310] shadow-[0_0_50px_rgba(168,85,247,0.35)] overflow-hidden">
            <div className="p-3.5 border-b border-purple-500/25 flex items-center gap-3">
              <Search className="w-4 h-4 text-purple-400" />
              <input
                type="text"
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter findings or discovered endpoints by keyword..."
                className="flex-1 bg-transparent text-xs font-mono text-white outline-none"
              />
              <button
                type="button"
                onClick={() => setSearchOpen(false)}
                className="text-zinc-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 max-h-80 overflow-y-auto space-y-4 text-xs font-mono">
              <div>
                <div className="text-[10px] uppercase text-purple-300 mb-2 font-bold">
                  Matching Findings ({matchedVerdicts.length})
                </div>
                {matchedVerdicts.length === 0 ? (
                  <div className="text-zinc-500">No matching findings.</div>
                ) : (
                  <div className="space-y-1.5">
                    {matchedVerdicts.map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => {
                          scanStore.dispatch({ type: 'GO_TO_STEP', payload: 4 });
                          setSearchOpen(false);
                        }}
                        className="w-full p-2 rounded-lg bg-black/60 hover:bg-purple-500/15 border border-purple-500/20 flex items-center justify-between text-left cursor-pointer"
                      >
                        <span className="text-white truncate">
                          [{f.severity}] {f.module || f.owasp}
                        </span>
                        <span className="text-zinc-400 truncate max-w-[180px]">{f.url}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <div className="text-[10px] uppercase text-purple-300 mb-2 font-bold">
                  Matching Endpoints ({matchedEndpoints.length})
                </div>
                {matchedEndpoints.length === 0 ? (
                  <div className="text-zinc-500">No matching endpoints.</div>
                ) : (
                  <div className="space-y-1">
                    {matchedEndpoints.map((ep) => (
                      <button
                        key={ep}
                        type="button"
                        onClick={() => {
                          scanStore.dispatch({ type: 'GO_TO_STEP', payload: 2 });
                          setSearchOpen(false);
                        }}
                        className="w-full p-2 rounded-lg bg-black/60 hover:bg-purple-500/15 border border-purple-500/20 flex items-center justify-between text-left cursor-pointer"
                      >
                        <span className="text-zinc-200 truncate">{ep}</span>
                        <span className="text-purple-300 text-[10px]">IN SCOPE</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
