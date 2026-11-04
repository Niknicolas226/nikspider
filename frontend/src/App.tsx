import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Target,
  PlanItem,
  RoadmapNode,
  RequestLogEntry,
  SSEEvent,
  TriageResult,
  ScanProfile,
  Severity,
} from './types';
import {
  startScan,
  subscribeScanSSE,
  getRoadmap,
  getRequestLogs,
  retestFindingDetailed,
  checkBackendHealth,
  getTargetHistory,
  controlScan,
  ScanHistoryPoint,
} from './api/client';
import { PROFILES } from './styles/theme';
import HomeVerifyGate from './components/HomeVerifyGate';
import { OverviewKpiStrip } from './components/OverviewKpiStrip';
import {
  SpiderStatusHero,
  SpiderCliLine,
  LegModuleCluster,
} from './components/SpiderStatusHero';
import { CommandTerminalPanel, TerminalLogLine } from './components/CommandTerminalPanel';
import { LiveTelemetryPanel } from './components/LiveTelemetryPanel';
import { VulnerabilityIntelTable } from './components/VulnerabilityIntelTable';
import { SecurityEventStream, SecurityStreamItem } from './components/SecurityEventStream';
import { EndpointRadarWeb, DiscoveredEndpointNode } from './components/EndpointRadarWeb';
import { TabLiveScan } from './components/TabLiveScan';
import { TabAgentReasoning } from './components/TabAgentReasoning';
import { RoadmapTree } from './components/RoadmapTree';
import { RoadmapDrawer } from './components/RoadmapDrawer';
import mascotImage from './assets/nikspider-mascot.png';
import {
  Home,
  Radar,
  ShieldAlert,
  Monitor,
  Terminal,
  Activity,
  FileText,
  Settings,
  HelpCircle,
  Search,
  Bell,
  Maximize2,
  Minimize2,
  SunMoon,
  ShieldCheck,
  Play,
  Loader2,
  Download,
  ExternalLink,
  X,
  ChevronRight,
  BrainCircuit,
  GitBranch,
  Sparkles,
  Zap,
} from 'lucide-react';

type SidebarSection =
  | 'overview'
  | 'scan_center'
  | 'vulnerabilities'
  | 'endpoints'
  | 'command_terminal'
  | 'activity_logs'
  | 'reports'
  | 'settings'
  | 'help_docs';

export function App() {
  // ═══════════════════════════════════════════════════════════════════
  // STRICT VERIFICATION GATE — Nothing below mounts until verified
  // ═══════════════════════════════════════════════════════════════════
  const [verifiedTarget, setVerifiedTarget] = useState<Target | null>(null);

  // Navigation & UI Chrome State
  const [activeSection, setActiveSection] = useState<SidebarSection>('overview');
  const [selectedProfile, setSelectedProfile] = useState<ScanProfile>('standard');
  const [highGlowMode, setHighGlowMode] = useState<boolean>(true);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Search Modal (Ctrl+K) & Notification Popover
  const [searchOpen, setSearchOpen] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [notificationsOpen, setNotificationsOpen] = useState<boolean>(false);
  const [unreadNotifications, setUnreadNotifications] = useState<number>(0);

  // Real Backend Health & Target History State
  const [engineOnline, setEngineOnline] = useState<boolean>(false);
  const [demoMode, setDemoMode] = useState<boolean>(false);
  const [scanHistory, setScanHistory] = useState<ScanHistoryPoint[]>([]);

  // Active Scan State (fed by single SSE subscription + GET /api/v2/scans/{id}/roadmap & /requests)
  const [activeScanId, setActiveScanId] = useState<string | null>(null);
  const [scanStatus, setScanStatus] = useState<
    'idle' | 'queued' | 'running' | 'completed' | 'failed'
  >('idle');
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [scanStage, setScanStage] = useState<number>(0);
  const [scanStartedAt, setScanStartedAt] = useState<string | null>(null);
  const [scanCompletedAt, setScanCompletedAt] = useState<string | null>(null);
  const [launchingScan, setLaunchingScan] = useState<boolean>(false);
  const [scanError, setScanError] = useState<string | null>(null);

  // Live Telemetry & KPI Counters
  const [riskScore, setRiskScore] = useState<number>(0);
  const [pagesCrawled, setPagesCrawled] = useState<number>(0);
  const [crawlQueue, setCrawlQueue] = useState<number>(0);
  const [checksDone, setChecksDone] = useState<number>(0);

  // Spider Mascot Reactive Pulse, Module Leg Counters & Look-At State
  const [eventPulseTick, setEventPulseTick] = useState<number>(0);
  const [confirmedFlashTick, setConfirmedFlashTick] = useState<number>(0);
  const [moduleProbeCounts, setModuleProbeCounts] = useState<Record<string, number>>({});
  const [activeProbingModule, setActiveProbingModule] = useState<string | null>(null);
  const [lastConfirmedModule, setLastConfirmedModule] = useState<string | null>(null);
  const [selectedLegFilter, setSelectedLegFilter] = useState<LegModuleCluster | null>(null);
  const [selectedSeverityFilter, setSelectedSeverityFilter] = useState<Severity | null>(null);
  const [lookDirection, setLookDirection] = useState<
    'none' | 'left' | 'center-left' | 'center' | 'right'
  >('none');
  const lookTimeoutRef = useRef<number | null>(null);

  // Shared Data Streams
  const [sseEvents, setSseEvents] = useState<SSEEvent[]>([]);
  const [spiderCliLines, setSpiderCliLines] = useState<SpiderCliLine[]>([
    { id: 'cli-init-1', text: '> nikspider --ready', tone: 'violet' },
    { id: 'cli-init-2', text: '✓ guard active · scope locked', tone: 'ok' },
  ]);
  const [commandLogs, setCommandLogs] = useState<TerminalLogLine[]>([
    {
      id: 'init-1',
      tag: 'SYSTEM',
      text: 'NikSpider initialized.',
      ts: new Date().toLocaleTimeString(),
    },
    {
      id: 'init-2',
      tag: 'INFO',
      text: 'Dashboard ready.',
      ts: new Date().toLocaleTimeString(),
    },
    {
      id: 'init-3',
      tag: 'INFO',
      text: 'Waiting for command...',
      ts: new Date().toLocaleTimeString(),
    },
  ]);
  const [securityEvents, setSecurityEvents] = useState<SecurityStreamItem[]>([]);
  const [findings, setFindings] = useState<TriageResult[]>([]);
  const [roadmapNodes, setRoadmapNodes] = useState<RoadmapNode[]>([]);
  const [requestLogs, setRequestLogs] = useState<RequestLogEntry[]>([]);
  const [discoveredEndpoints, setDiscoveredEndpoints] = useState<
    Map<string, DiscoveredEndpointNode>
  >(() => new Map());

  // Selected Finding / Roadmap Node for Deep Inspection
  const [selectedFindingId, setSelectedFindingId] = useState<string | null>(null);
  const [selectedRoadmapNode, setSelectedRoadmapNode] = useState<RoadmapNode | null>(null);

  // Track recent event arrival timestamps to compute real rolling 5-second RPS
  const requestTimestampsRef = useRef<number[]>([]);
  const [rollingRps, setRollingRps] = useState<number>(0);

  const triggerLookToward = useCallback(
    (dir: 'left' | 'center-left' | 'center' | 'right') => {
      setLookDirection(dir);
      if (lookTimeoutRef.current) {
        clearTimeout(lookTimeoutRef.current);
      }
      lookTimeoutRef.current = window.setTimeout(() => {
        setLookDirection('none');
      }, 1350);
    },
    []
  );

  const appendCommandLog = useCallback((tag: TerminalLogLine['tag'], text: string) => {
    setCommandLogs((prev) => [
      ...prev,
      {
        id: `cmd-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        tag,
        text,
        ts: new Date().toLocaleTimeString(),
      },
    ]);
  }, []);

  const appendSpiderCli = useCallback(
    (text: string, tone: SpiderCliLine['tone'] = 'violet') => {
      setSpiderCliLines((prev) => [
        ...prev.slice(-20),
        {
          id: `scli-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          text,
          tone,
        },
      ]);
    },
    []
  );

  const pushSecurityEvent = useCallback(
    (text: string, tone: SecurityStreamItem['tone'] = 'purple') => {
      setSecurityEvents((prev) => [
        {
          id: `sec-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          text,
          tone,
          createdAtMs: Date.now(),
        },
        ...prev.slice(0, 49),
      ]);
      setUnreadNotifications((n) => n + 1);
    },
    []
  );

  const registerEndpoint = useCallback((url: string, flagged = false, depth = 1) => {
    if (!url) return;
    setDiscoveredEndpoints((prev) => {
      const next = new Map(prev);
      const existing = next.get(url);
      next.set(url, {
        url,
        status: flagged || existing?.status === 'flagged' ? 'flagged' : 'clean',
        depth: existing ? Math.min(existing.depth, depth) : depth,
      });
      return next;
    });
  }, []);

  // ═══════════════════════════════════════════════════════════════════
  // 1. REAL HEALTH CHECK POLLING (GET /api/v2/health every 30s)
  // ═══════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (!verifiedTarget) return;
    let cancelled = false;

    const pollHealth = async () => {
      const status = await checkBackendHealth();
      if (!cancelled) {
        setEngineOnline(status.online);
        setDemoMode(status.demoMode);
      }
    };

    pollHealth();
    const interval = setInterval(pollHealth, 30000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [verifiedTarget]);

  // ═══════════════════════════════════════════════════════════════════
  // 2. LOAD REAL TARGET SCAN HISTORY FOR SPARKLINES
  // ═══════════════════════════════════════════════════════════════════
  const refreshTargetHistory = useCallback(async () => {
    if (!verifiedTarget) return;
    const pts = await getTargetHistory(verifiedTarget.id);
    setScanHistory(pts);
  }, [verifiedTarget]);

  useEffect(() => {
    if (!verifiedTarget) return;
    refreshTargetHistory();
  }, [verifiedTarget, refreshTargetHistory]);

  // ═══════════════════════════════════════════════════════════════════
  // 3. CTRL+K KEYBOARD SHORTCUT FOR GLOBAL SEARCH
  // ═══════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (!verifiedTarget) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      } else if (e.key === 'Escape') {
        setSearchOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [verifiedTarget]);

  // ═══════════════════════════════════════════════════════════════════
  // 4. ROLLING 5-SECOND REQUESTS/SECOND COMPUTATION
  // ═══════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (scanStatus !== 'running' || isPaused) {
      setRollingRps(0);
      return;
    }
    const timer = setInterval(() => {
      const cutoff = Date.now() - 5000;
      requestTimestampsRef.current = requestTimestampsRef.current.filter((t) => t >= cutoff);
      const rpsFromEvents = Math.round(requestTimestampsRef.current.length / 5);
      setRollingRps(rpsFromEvents);
    }, 1000);
    return () => clearInterval(timer);
  }, [scanStatus, isPaused]);

  // ═══════════════════════════════════════════════════════════════════
  // 5. REFRESH ROADMAP & REQUEST LOGS FROM BACKEND
  // ═══════════════════════════════════════════════════════════════════
  const refreshScanSnapshot = useCallback(
    async (scanId: string) => {
      try {
        const [reqs, roadmap] = await Promise.all([
          getRequestLogs(scanId).catch(() => [] as RequestLogEntry[]),
          getRoadmap(scanId).catch(() => null),
        ]);
        setRequestLogs(reqs);
        reqs.forEach((r, idx) => registerEndpoint(r.url, false, idx % 3));

        if (roadmap) {
          setRiskScore(roadmap.score || 0);
          setRoadmapNodes(roadmap.nodes || []);
        }
      } catch {
        // non-fatal during initial spinup
      }
    },
    [registerEndpoint]
  );

  // ═══════════════════════════════════════════════════════════════════
  // 6. SINGLE SHARED SSE SUBSCRIPTION PER ACTIVE SCAN
  // ═══════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (!activeScanId) return;

    const cleanup = subscribeScanSSE(
      activeScanId,
      (ev: SSEEvent) => {
        setEventPulseTick((t) => t + 1);
        requestTimestampsRef.current.push(Date.now());
        setSseEvents((prev) => [...prev, ev]);

        if (ev.type === 'crawl_progress') {
          const pages = Number(ev.pages ?? 0);
          const queue = Number(ev.queue ?? 0);
          setPagesCrawled(pages);
          setCrawlQueue(queue);
          setScanStage((s) => Math.max(s, 1));
          pushSecurityEvent(`Crawling surface: ${pages} pages mapped`, 'purple');
          appendSpiderCli(`✓ crawl: ${pages} pages (q:${queue})`, 'ok');
          appendCommandLog('INFO', `Crawler mapped ${pages} pages (queue: ${queue})`);
        } else if (ev.type === 'plan_ready') {
          const plan: PlanItem[] = Array.isArray(ev.plan) ? ev.plan : [];
          setScanStage((s) => Math.max(s, 2));
          plan.forEach((p, i) => registerEndpoint(p.url, false, i % 3));
          appendSpiderCli(`✓ plan locked: ${plan.length} routes`, 'violet');
          appendCommandLog('SYSTEM', `Attack plan locked: ${plan.length} target endpoints.`);
          pushSecurityEvent(`Analysis plan ready (${plan.length} endpoints)`, 'purple');
        } else if (ev.type === 'probe_started') {
          const mod = (ev.module || 'probe').toLowerCase();
          setActiveProbingModule(mod);
          setModuleProbeCounts((prev) => ({
            ...prev,
            [mod]: (prev[mod] || 0) + 1,
          }));
          setScanStage((s) => Math.max(s, 2));
          if (ev.url) registerEndpoint(ev.url, false, 1);
          appendSpiderCli(`→ probe [${mod}]: ${ev.url || '/'}`, 'violet');
        } else if (ev.type === 'raw_flag') {
          const mod = (ev.module || 'probe').toLowerCase();
          const url = ev.url || '';
          setActiveProbingModule(mod);
          setModuleProbeCounts((prev) => ({
            ...prev,
            [mod]: (prev[mod] || 0) + 1,
          }));
          setChecksDone((c) => c + 1);
          setScanStage((s) => Math.max(s, 3));
          registerEndpoint(url, true, 1);
          // Tier 2: Spider looks toward the Vulnerability Intelligence table below when a flag lands
          triggerLookToward('center-left');
          appendSpiderCli(`⚠ flag: ${mod} on ${url}`, 'warn');
          appendCommandLog('WARN', `Potential signal [${mod}] detected on ${url}`);
          pushSecurityEvent(`Potential ${mod} signal on ${url}`, 'amber');
        } else if (ev.type === 'triage_result') {
          setScanStage((s) => Math.max(s, 4));
          const isConfirmed = ev.verdict === 'confirmed';
          const confPct = Math.round(
            ev.confidence > 1 ? ev.confidence : (ev.confidence || 0.85) * 100
          );

          if (isConfirmed) {
            setConfirmedFlashTick((t) => t + 1);
            setLastConfirmedModule((ev.module || '').toLowerCase());
            // Tier 2: Spider looks toward the severity badge column in the table below
            const sevUpper = (ev.severity || 'Medium').toUpperCase();
            if (sevUpper === 'CRITICAL' || sevUpper === 'HIGH') {
              triggerLookToward('left');
            } else if (sevUpper === 'MEDIUM') {
              triggerLookToward('center-left');
            } else {
              triggerLookToward('center');
            }
          }

          setFindings((prev) => {
            const exists = prev.some((f) => f.id === ev.id);
            return exists ? prev.map((f) => (f.id === ev.id ? ev : f)) : [ev, ...prev];
          });

          if (ev.url) {
            registerEndpoint(ev.url, isConfirmed, 1);
          }

          appendSpiderCli(
            `${isConfirmed ? '✓ CONFIRMED' : '✗ REJECTED'}: ${ev.module || ev.id} [${ev.severity}]`,
            isConfirmed ? 'warn' : 'ok'
          );
          appendCommandLog(
            isConfirmed ? 'FLAG' : 'INFO',
            `${ev.verdict.toUpperCase()}: ${ev.module || 'Finding'} (${ev.url || '/'}) [${confPct}%]`
          );
          pushSecurityEvent(
            `${isConfirmed ? 'Confirmed' : 'Rejected'}: ${ev.module || 'Finding'} (${ev.severity})`,
            isConfirmed ? 'red' : 'purple'
          );
        } else if (ev.type === 'scan_control') {
          if (ev.status === 'paused') {
            setIsPaused(true);
            appendSpiderCli('⏸ scan paused by operator', 'warn');
          } else if (ev.status === 'running') {
            setIsPaused(false);
            appendSpiderCli('▶ scan resumed', 'ok');
          } else if (ev.status === 'stopped') {
            setIsPaused(false);
            setScanStatus('completed');
            setActiveProbingModule(null);
            appendSpiderCli('■ scan stopped by operator', 'warn');
          }
        } else if (ev.type === 'roadmap_ready') {
          const score = Number(ev.score ?? 0);
          const count = Number(ev.nodes ?? 0);
          setRiskScore(score);
          setScanStage(6);
          setIsPaused(false);
          setActiveProbingModule(null);
          setScanStatus('completed');
          setScanCompletedAt(new Date().toISOString());

          appendSpiderCli(`✓ complete — risk ${score}/100 (${count} fixes)`, 'ok');
          appendCommandLog(
            'SYSTEM',
            `Scan completed. Risk Score: ${score}/100 · Remediation nodes: ${count}`
          );
          pushSecurityEvent('Scan completed successfully', 'emerald');
          refreshScanSnapshot(activeScanId);
          refreshTargetHistory();
        }
      },
      () => {
        refreshScanSnapshot(activeScanId);
      }
    );

    return cleanup;
  }, [
    activeScanId,
    appendCommandLog,
    appendSpiderCli,
    pushSecurityEvent,
    refreshScanSnapshot,
    refreshTargetHistory,
    registerEndpoint,
    triggerLookToward,
  ]);

  // Poll request logs & roadmap periodically while scan is running
  useEffect(() => {
    if (!activeScanId || (scanStatus !== 'running' && scanStatus !== 'queued')) return;
    const interval = setInterval(() => {
      refreshScanSnapshot(activeScanId);
    }, 3500);
    return () => clearInterval(interval);
  }, [activeScanId, scanStatus, refreshScanSnapshot]);

  // ═══════════════════════════════════════════════════════════════════
  // 7. START SCAN, CONTROL SCAN (PAUSE/RESUME/STOP) & RETEST HANDLERS
  // ═══════════════════════════════════════════════════════════════════
  const handleStartScan = useCallback(
    async (profileOverride?: ScanProfile) => {
      if (!verifiedTarget) return;
      const profileToUse = profileOverride || selectedProfile;
      setSelectedProfile(profileToUse);
      setLaunchingScan(true);
      setScanError(null);

      try {
        const scanId = await startScan(verifiedTarget.id, profileToUse);
        const nowIso = new Date().toISOString();
        setActiveScanId(scanId);
        setScanStatus('running');
        setIsPaused(false);
        setScanStage(1);
        setScanStartedAt(nowIso);
        setScanCompletedAt(null);
        setPagesCrawled(0);
        setCrawlQueue(0);
        setChecksDone(0);
        setModuleProbeCounts({});
        setActiveProbingModule(null);
        setLastConfirmedModule(null);
        setFindings([]);
        setRoadmapNodes([]);
        setSseEvents([]);
        setRequestLogs([]);
        setDiscoveredEndpoints(
          new Map([[verifiedTarget.url, { url: verifiedTarget.url, status: 'clean', depth: 0 }]])
        );

        appendSpiderCli(`> nikspider scan ${verifiedTarget.url} --profile=${profileToUse}`, 'violet');
        appendCommandLog(
          'SYSTEM',
          `Scan ${scanId} started on ${verifiedTarget.url} (profile=${profileToUse}).`
        );
        pushSecurityEvent('Scan started by NikSpider', 'purple');
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to start scan';
        setScanError(msg);
        appendCommandLog('ERROR', msg);
      } finally {
        setLaunchingScan(false);
      }
    },
    [verifiedTarget, selectedProfile, appendCommandLog, appendSpiderCli, pushSecurityEvent]
  );

  const handleControlScan = useCallback(
    async (action: 'pause' | 'resume' | 'stop') => {
      if (!activeScanId) return;
      try {
        await controlScan(activeScanId, action);
        if (action === 'pause') {
          setIsPaused(true);
          appendCommandLog('WARN', `Scan ${activeScanId.slice(0, 8)} paused.`);
        } else if (action === 'resume') {
          setIsPaused(false);
          appendCommandLog('INFO', `Scan ${activeScanId.slice(0, 8)} resumed.`);
        } else if (action === 'stop') {
          setIsPaused(false);
          setScanStatus('completed');
          setActiveProbingModule(null);
          appendCommandLog('WARN', `Scan ${activeScanId.slice(0, 8)} stopped by user.`);
        }
      } catch (err: unknown) {
        appendCommandLog(
          'ERROR',
          err instanceof Error ? err.message : `Failed to ${action} scan.`
        );
      }
    },
    [activeScanId, appendCommandLog]
  );

  const handleRetestFinding = useCallback(
    async (findingId: string) => {
      const res = await retestFindingDetailed(findingId);
      if (typeof res.score === 'number') {
        setRiskScore(res.score);
      }
      appendCommandLog(
        res.passed ? 'INFO' : 'WARN',
        `Live Retest [${findingId.slice(0, 8)}]: ${res.passed ? 'FIXED ✓' : 'STILL OPEN'}`
      );
      pushSecurityEvent(
        `Retest ${res.passed ? 'FIXED' : 'OPEN'} for finding ${findingId}`,
        res.passed ? 'emerald' : 'amber'
      );
      if (activeScanId) {
        refreshScanSnapshot(activeScanId);
      }
    },
    [activeScanId, appendCommandLog, pushSecurityEvent, refreshScanSnapshot]
  );

  // Fullscreen API toggle
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  // Derived real metrics
  const confirmedFindings = useMemo(
    () => findings.filter((f) => f.verdict === 'confirmed'),
    [findings]
  );

  const highSeverityCount = useMemo(
    () =>
      confirmedFindings.filter((f) => {
        const s = (f.severity || '').toUpperCase();
        return s === 'CRITICAL' || s === 'HIGH';
      }).length,
    [confirmedFindings]
  );

  const endpointList = useMemo(
    () => Array.from(discoveredEndpoints.values()),
    [discoveredEndpoints]
  );

  const totalEndpointsCount = Math.max(endpointList.length, pagesCrawled);

  const progressPct = useMemo(() => {
    if (scanStatus === 'completed') return 100;
    if (scanStatus === 'idle') return 0;
    const stageBase = Math.min(90, scanStage * 15);
    const checkBonus = Math.min(15, checksDone * 2);
    return Math.min(96, Math.max(8, stageBase + checkBonus));
  }, [scanStatus, scanStage, checksDone]);

  const elapsedFormatted = useMemo(() => {
    if (!scanStartedAt) return '00:00';
    const startMs = new Date(scanStartedAt).getTime();
    const endMs = scanCompletedAt ? new Date(scanCompletedAt).getTime() : Date.now();
    const secs = Math.max(0, Math.floor((endMs - startMs) / 1000));
    const mins = Math.floor(secs / 60);
    const rem = secs % 60;
    return `${String(mins).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
  }, [scanStartedAt, scanCompletedAt, eventPulseTick]);

  // Global Search Results (Ctrl+K)
  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) {
      return {
        matchedFindings: confirmedFindings.slice(0, 5),
        matchedEndpoints: endpointList.slice(0, 5),
      };
    }
    return {
      matchedFindings: findings.filter(
        (f) =>
          (f.module || '').toLowerCase().includes(q) ||
          (f.url || '').toLowerCase().includes(q) ||
          (f.owasp || '').toLowerCase().includes(q) ||
          (f.severity || '').toLowerCase().includes(q)
      ),
      matchedEndpoints: endpointList.filter((ep) => ep.url.toLowerCase().includes(q)),
    };
  }, [searchQuery, findings, confirmedFindings, endpointList]);

  // ═══════════════════════════════════════════════════════════════════
  // STRICT OWNERSHIP GATE RENDER
  // ═══════════════════════════════════════════════════════════════════
  if (!verifiedTarget || !verifiedTarget.verified) {
    return (
      <HomeVerifyGate
        onVerified={(target, profile) => {
          setVerifiedTarget(target);
          if (profile) {
            setSelectedProfile(profile);
          }
          setDiscoveredEndpoints(
            new Map([[target.url, { url: target.url, status: 'clean', depth: 0 }]])
          );
        }}
      />
    );
  }

  // Extract hostname for Active Target card
  let targetHost = verifiedTarget.url;
  try {
    targetHost = new URL(verifiedTarget.url).host;
  } catch {
    targetHost = verifiedTarget.url;
  }

  const activeScansBadgeCount = scanStatus === 'running' || scanStatus === 'queued' ? 1 : 0;

  return (
    <div
      className={`min-h-screen bg-[#000000] text-white flex select-none sm:select-auto overflow-x-hidden ${
        highGlowMode ? '' : 'opacity-95'
      }`}
    >
      {/* Ambient Violet/Purple Radial Background */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background: highGlowMode
            ? 'radial-gradient(circle at 48% 38%, rgba(168, 85, 247, 0.14) 0%, rgba(15, 5, 29, 0.4) 45%, rgba(0, 0, 0, 1) 85%)'
            : 'none',
        }}
      />

      {/* ═══════════════════════════════════════════════════════════════════
          LEFT SIDEBAR
      ═══════════════════════════════════════════════════════════════════ */}
      <aside
        className="relative z-20 w-60 shrink-0 border-r border-purple-500/30 bg-[#05020a]/95 backdrop-blur-2xl flex flex-col justify-between p-3.5"
        style={{
          boxShadow: '4px 0 30px rgba(168, 85, 247, 0.12)',
        }}
      >
        <div className="space-y-5">
          {/* Brand Logo */}
          <div className="flex items-center gap-3 px-2 pt-1">
            <div className="w-10 h-10 rounded-xl overflow-hidden border border-purple-400/50 bg-purple-950/40 shadow-[0_0_18px_rgba(168,85,247,0.4)] shrink-0">
              <img
                src={mascotImage}
                alt="NikSpider"
                className="w-full h-full object-cover scale-125"
              />
            </div>
            <div className="min-w-0">
              <div className="text-base font-extrabold tracking-tight text-white leading-none">
                NikSpider
              </div>
              <div className="text-[9px] font-mono uppercase tracking-[0.18em] text-purple-300/80 mt-1">
                AI APPSEC PLATFORM
              </div>
            </div>
          </div>

          {/* Primary Navigation */}
          <nav className="space-y-1">
            {(
              [
                { id: 'overview', label: 'Overview', icon: Home, badge: null },
                {
                  id: 'scan_center',
                  label: 'Scan Center',
                  icon: Radar,
                  badge: String(activeScansBadgeCount).padStart(2, '0'),
                },
                {
                  id: 'vulnerabilities',
                  label: 'Agent Debater',
                  icon: BrainCircuit,
                  badge: String(confirmedFindings.length),
                },
                {
                  id: 'reports',
                  label: 'Roadmap Creator',
                  icon: GitBranch,
                  badge: String(roadmapNodes.length),
                },
                {
                  id: 'endpoints',
                  label: 'Endpoints',
                  icon: Monitor,
                  badge: String(totalEndpointsCount),
                },
                {
                  id: 'command_terminal',
                  label: 'Command Terminal',
                  icon: Terminal,
                  badge: null,
                },
              ] as const
            ).map((item) => {
              const Icon = item.icon;
              const active = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveSection(item.id)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition cursor-pointer ${
                    active
                      ? 'bg-gradient-to-r from-purple-600/35 to-purple-900/20 text-white border border-purple-400/50 shadow-[0_0_20px_rgba(168,85,247,0.28)]'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-purple-500/10 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon
                      className={`w-4 h-4 ${
                        active ? 'text-purple-300' : 'text-zinc-400'
                      }`}
                    />
                    <span>{item.label}</span>
                  </div>
                  {item.badge !== null && (
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold border ${
                        active
                          ? 'bg-purple-500/30 text-purple-200 border-purple-400/50'
                          : 'bg-purple-950/50 text-zinc-300 border-purple-500/25'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}

            <div className="my-2 border-t border-purple-500/15" />

            {(
              [
                { id: 'activity_logs', label: 'Activity Logs', icon: Activity },
                { id: 'settings', label: 'Settings', icon: Settings },
                { id: 'help_docs', label: 'Help & Docs', icon: HelpCircle },
              ] as const
            ).map((item) => {
              const Icon = item.icon;
              const active = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveSection(item.id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition cursor-pointer ${
                    active
                      ? 'bg-gradient-to-r from-purple-600/35 to-purple-900/20 text-white border border-purple-400/50 shadow-[0_0_20px_rgba(168,85,247,0.28)]'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-purple-500/10 border border-transparent'
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 ${
                      active ? 'text-purple-300' : 'text-zinc-400'
                    }`}
                  />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom Cards: Active Target + User Session */}
        <div className="space-y-2.5 pt-4">
          {/* Active Target Card (bound to real verifiedTarget record) */}
          <div
            className="rounded-xl border border-purple-500/35 bg-[#090412]/90 p-3"
            style={{ boxShadow: '0 0 20px rgba(168, 85, 247, 0.14)' }}
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-purple-500/15 border border-purple-400/40 flex items-center justify-center shrink-0">
                <Radar className="w-4 h-4 text-purple-300" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[10px] text-zinc-400">Active Target</div>
                <div
                  className="text-xs font-mono font-bold text-white truncate"
                  title={verifiedTarget.url}
                >
                  {targetHost}
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      verifiedTarget.verified ? 'bg-emerald-400' : 'bg-red-400'
                    }`}
                  />
                  <span
                    className={`text-[10px] font-mono ${
                      verifiedTarget.verified ? 'text-emerald-400' : 'text-red-400'
                    }`}
                  >
                    {verifiedTarget.verified ? 'In Scope' : 'Out of Scope'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Session Card */}
          <div className="rounded-xl border border-purple-500/25 bg-[#090412]/80 px-3 py-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-fuchsia-600 flex items-center justify-center text-xs font-bold text-white shrink-0">
                N
              </div>
              <div className="min-w-0">
                <div className="text-xs font-semibold text-white truncate">
                  NikSpider Admin
                </div>
                <div className="flex items-center gap-1 text-[10px] text-emerald-400 font-mono">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span>Online</span>
                </div>
              </div>
            </div>
            <ChevronRight className="w-3.5 h-3.5 text-zinc-500" />
          </div>
        </div>
      </aside>

      {/* ═══════════════════════════════════════════════════════════════════
          MAIN WORKSPACE COLUMN (TOP BAR + VIEW CONTENT)
      ═══════════════════════════════════════════════════════════════════ */}
      <div className="relative z-10 flex-1 flex flex-col min-w-0">
        {/* TOP BAR */}
        <header className="h-14 border-b border-purple-500/25 bg-[#05020a]/85 backdrop-blur-xl px-5 flex items-center justify-between gap-4 sticky top-0 z-30">
          {/* Center/Left Search Trigger (Ctrl + K) */}
          <button
            onClick={() => setSearchOpen(true)}
            className="w-full max-w-md flex items-center justify-between px-3.5 py-1.5 rounded-xl bg-[#090412] border border-purple-500/35 hover:border-purple-400/60 text-xs text-zinc-400 transition cursor-pointer shadow-[0_0_16px_rgba(168,85,247,0.1)]"
          >
            <div className="flex items-center gap-2.5">
              <Search className="w-3.5 h-3.5 text-purple-400" />
              <span>Search anything... (Ctrl + K)</span>
            </div>
            <kbd className="px-1.5 py-0.5 rounded bg-purple-950/60 border border-purple-500/30 text-[10px] font-mono text-purple-300">
              Ctrl+K
            </kbd>
          </button>

          {/* Right Action Strip */}
          <div className="flex items-center gap-3">
            {/* Quick Scan Trigger Button in Top Bar */}
            <button
              onClick={() => handleStartScan()}
              disabled={launchingScan || (scanStatus === 'running' && !isPaused)}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-purple-600/30 hover:bg-purple-600/50 disabled:opacity-50 border border-purple-400/50 text-xs font-mono font-semibold text-purple-100 shadow-[0_0_16px_rgba(168,85,247,0.3)] transition cursor-pointer"
            >
              {launchingScan || (scanStatus === 'running' && !isPaused) ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-300" />
                  <span>Scanning...</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 text-purple-300 fill-purple-300" />
                  <span>Run Scan ({selectedProfile})</span>
                </>
              )}
            </button>

            {/* Real Health Check Pill */}
            <div
              className={`px-3 py-1 rounded-full border text-xs font-mono font-semibold flex items-center gap-2 ${
                engineOnline
                  ? 'bg-emerald-950/40 border-emerald-500/45 text-emerald-300 shadow-[0_0_16px_rgba(34,197,94,0.2)]'
                  : 'bg-red-950/40 border-red-500/45 text-red-300 shadow-[0_0_16px_rgba(239,68,68,0.2)]'
              }`}
              title="Polled from GET /api/v2/health every 30s"
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  engineOnline ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'
                }`}
              />
              <span>{engineOnline ? 'Engine Online' : 'Engine Offline'}</span>
            </div>

            {/* Conditional Demo Environment Badge (only shown when backend DEMO_MODE=1) */}
            {demoMode && (
              <div className="px-3 py-1 rounded-full bg-purple-950/50 border border-purple-400/40 text-xs font-medium text-purple-200 flex items-center gap-1.5 shadow-[0_0_14px_rgba(168,85,247,0.2)]">
                <ShieldCheck className="w-3.5 h-3.5 text-purple-400" />
                <span>Demo Environment</span>
              </div>
            )}

            {/* Meta Model Status Indicator */}
            <div
              className="hidden xl:flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-950/60 border border-purple-400/40 text-xs font-mono text-purple-200 shadow-[0_0_14px_rgba(168,85,247,0.25)]"
              title="Meta Model API: muse-wonder-1.0 (Debate Triage & Roadmap) + muse-spark-1.3 (Fast Probes)"
            >
              <Sparkles className="w-3.5 h-3.5 text-purple-400" />
              <span className="text-[11px] font-semibold">Meta AI: muse-wonder-1.0</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            </div>

            {/* Notification Bell with Real Unread Count */}
            <div className="relative">
              <button
                onClick={() => {
                  setNotificationsOpen((o) => !o);
                  setUnreadNotifications(0);
                }}
                className="p-2 rounded-xl bg-[#090412] border border-purple-500/30 hover:border-purple-400/60 text-zinc-300 hover:text-white transition cursor-pointer relative"
                title="Security Event Notifications"
              >
                <Bell className="w-4 h-4" />
                {unreadNotifications > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-[10px] font-mono font-bold text-white flex items-center justify-center">
                    {unreadNotifications > 99 ? '99+' : unreadNotifications}
                  </span>
                )}
              </button>

              {notificationsOpen && (
                <div className="absolute right-0 mt-2 w-80 rounded-2xl bg-[#090412] border border-purple-500/45 shadow-[0_0_30px_rgba(168,85,247,0.3)] p-3 z-50">
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-purple-500/20">
                    <span className="text-xs font-semibold text-white">
                      Recent Scan Notifications
                    </span>
                    <button
                      onClick={() => setNotificationsOpen(false)}
                      className="text-zinc-400 hover:text-white cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="max-h-60 overflow-y-auto space-y-2 text-xs">
                    {securityEvents.length === 0 ? (
                      <div className="text-zinc-500 font-mono py-4 text-center">
                        No scan events yet.
                      </div>
                    ) : (
                      securityEvents.slice(0, 8).map((ev) => (
                        <div
                          key={ev.id}
                          className="p-2 rounded-lg bg-black/60 border border-purple-500/20 text-zinc-200 font-mono text-[11px]"
                        >
                          {ev.text}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Fullscreen Toggle */}
            <button
              onClick={toggleFullscreen}
              className="p-2 rounded-xl bg-[#090412] border border-purple-500/30 hover:border-purple-400/60 text-zinc-300 hover:text-white transition cursor-pointer"
              title="Toggle Fullscreen"
            >
              {isFullscreen ? (
                <Minimize2 className="w-4 h-4" />
              ) : (
                <Maximize2 className="w-4 h-4" />
              )}
            </button>

            {/* Theme / Neon Contrast Toggle */}
            <button
              onClick={() => setHighGlowMode((g) => !g)}
              className="p-2 rounded-xl bg-[#090412] border border-purple-500/30 hover:border-purple-400/60 text-purple-300 hover:text-white transition cursor-pointer"
              title="Toggle Neon Glow Intensity"
            >
              <SunMoon className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Error Banner if scan launch failed */}
        {scanError && (
          <div className="mx-5 mt-3 p-3 rounded-xl bg-red-950/50 border border-red-500/40 text-red-300 text-xs font-mono flex items-center justify-between">
            <span>{scanError}</span>
            <button onClick={() => setScanError(null)} className="text-red-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            TOP QUICK-SWITCH WORKFLOW BAR
        ═══════════════════════════════════════════════════════════════════ */}
        <div className="mx-4 mt-3 px-4 py-2.5 rounded-2xl bg-[#07030d]/90 border border-purple-500/25 backdrop-blur-xl flex flex-wrap items-center justify-between gap-3 shadow-[0_0_24px_rgba(168,85,247,0.12)]">
          <div className="flex items-center gap-2 overflow-x-auto py-0.5 font-mono text-xs">
            <button
              onClick={() => setActiveSection('overview')}
              className={`px-3 py-1.5 rounded-xl flex items-center gap-2 transition cursor-pointer ${
                activeSection === 'overview'
                  ? 'bg-purple-600/40 text-white border border-purple-400/60 shadow-[0_0_14px_rgba(168,85,247,0.4)]'
                  : 'text-zinc-400 hover:text-white hover:bg-purple-500/10 border border-transparent'
              }`}
            >
              <Zap className="w-3.5 h-3.5 text-purple-400" />
              <span>Overview</span>
            </button>

            <button
              onClick={() => setActiveSection('vulnerabilities')}
              className={`px-3 py-1.5 rounded-xl flex items-center gap-2 transition cursor-pointer ${
                activeSection === 'vulnerabilities'
                  ? 'bg-gradient-to-r from-purple-600/50 to-pink-600/40 text-white border border-pink-400/60 shadow-[0_0_16px_rgba(236,72,153,0.45)]'
                  : 'text-zinc-400 hover:text-white hover:bg-purple-500/10 border border-transparent'
              }`}
            >
              <BrainCircuit className="w-3.5 h-3.5 text-pink-400" />
              <span className="font-semibold">Agent Debater</span>
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-pink-500/25 text-pink-200 border border-pink-400/40">
                {confirmedFindings.length}
              </span>
            </button>

            <button
              onClick={() => setActiveSection('reports')}
              className={`px-3 py-1.5 rounded-xl flex items-center gap-2 transition cursor-pointer ${
                activeSection === 'reports'
                  ? 'bg-gradient-to-r from-purple-600/50 to-cyan-600/40 text-white border border-cyan-400/60 shadow-[0_0_16px_rgba(6,182,212,0.4)]'
                  : 'text-zinc-400 hover:text-white hover:bg-purple-500/10 border border-transparent'
              }`}
            >
              <GitBranch className="w-3.5 h-3.5 text-cyan-400" />
              <span className="font-semibold">Roadmap Creator</span>
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-cyan-500/25 text-cyan-200 border border-cyan-400/40">
                {roadmapNodes.length}
              </span>
            </button>

            <button
              onClick={() => setActiveSection('scan_center')}
              className={`px-3 py-1.5 rounded-xl flex items-center gap-2 transition cursor-pointer ${
                activeSection === 'scan_center'
                  ? 'bg-purple-600/40 text-white border border-purple-400/60 shadow-[0_0_14px_rgba(168,85,247,0.4)]'
                  : 'text-zinc-400 hover:text-white hover:bg-purple-500/10 border border-transparent'
              }`}
            >
              <Radar className="w-3.5 h-3.5 text-purple-400" />
              <span>Live Scan Feed</span>
              {scanStatus === 'running' && (
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              )}
            </button>

            <button
              onClick={() => setActiveSection('command_terminal')}
              className={`px-3 py-1.5 rounded-xl flex items-center gap-2 transition cursor-pointer ${
                activeSection === 'command_terminal'
                  ? 'bg-purple-600/40 text-white border border-purple-400/60 shadow-[0_0_14px_rgba(168,85,247,0.4)]'
                  : 'text-zinc-400 hover:text-white hover:bg-purple-500/10 border border-transparent'
              }`}
            >
              <Terminal className="w-3.5 h-3.5 text-purple-400" />
              <span>Terminal</span>
            </button>
          </div>

          <div className="hidden md:flex items-center gap-2.5 font-mono text-[11px] text-zinc-400 shrink-0">
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-purple-950/50 border border-purple-500/30 text-purple-200">
              <Sparkles className="w-3 h-3 text-purple-400" />
              <span>Meta Muse Gateway</span>
            </span>
            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/35 text-emerald-300">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>muse-wonder-1.0</span>
            </span>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════
            MAIN CONTENT SWITCHER
        ═══════════════════════════════════════════════════════════════════ */}
        <main className="p-4 flex-1 space-y-3.5">
          {activeSection === 'overview' && (
            <>
              {/* INTERACTIVE ASSESSMENT & DEBATE / ROADMAP ACTION HERO */}
              {findings.length > 0 && (
                <div className="p-4 rounded-2xl bg-gradient-to-r from-purple-950/70 via-[#10061f] to-purple-950/40 border border-purple-500/40 shadow-[0_0_30px_rgba(168,85,247,0.18)] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 font-mono text-xs text-purple-300">
                      <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-200 border border-purple-400/40 text-[10px] font-bold uppercase flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-purple-400" />
                        Meta Model Synthesis
                      </span>
                      <span>•</span>
                      <span className="text-zinc-300">
                        {confirmedFindings.length} Confirmed Findings · {roadmapNodes.length} Root-Cause DAG Nodes
                      </span>
                    </div>
                    <h3 className="text-sm md:text-base font-bold text-white tracking-tight">
                      4-Agent Debate &amp; Root-Cause Remediation Graph Ready
                    </h3>
                    <p className="text-xs text-zinc-400 max-w-2xl">
                      Every vulnerability was cross-examined by Argumenter &amp; Opposer agents and verified against deterministic rules. Explore the full reasoning passes or execute the prioritized repair DAG.
                    </p>
                  </div>
                  <div className="flex items-center gap-2.5 shrink-0 w-full md:w-auto">
                    <button
                      onClick={() => setActiveSection('vulnerabilities')}
                      className="flex-1 md:flex-initial px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white text-xs font-mono font-bold shadow-[0_0_18px_rgba(236,72,153,0.4)] flex items-center justify-center gap-2 transition cursor-pointer"
                    >
                      <BrainCircuit className="w-4 h-4 text-pink-200" />
                      <span>Agent Debater ({confirmedFindings.length})</span>
                    </button>
                    <button
                      onClick={() => setActiveSection('reports')}
                      className="flex-1 md:flex-initial px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 text-white text-xs font-mono font-bold shadow-[0_0_18px_rgba(6,182,212,0.4)] flex items-center justify-center gap-2 transition cursor-pointer"
                    >
                      <GitBranch className="w-4 h-4 text-cyan-200" />
                      <span>Roadmap Creator ({roadmapNodes.length})</span>
                    </button>
                  </div>
                </div>
              )}

              {/* 1. FIVE-CARD KPI STRIP */}
              <OverviewKpiStrip
                riskScore={riskScore}
                confirmedCount={confirmedFindings.length}
                highSeverityCount={highSeverityCount}
                endpointsCount={totalEndpointsCount}
                scanStatus={scanStatus}
                scanStartedAt={scanStartedAt}
                scanCompletedAt={scanCompletedAt}
                history={scanHistory}
              />

              {/* 2. CENTER ROW: SPIDER STATUS HERO (7 cols) + TERMINAL & TELEMETRY (5 cols) */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
                <div className="lg:col-span-7">
                  <SpiderStatusHero
                    activeScanId={activeScanId}
                    isScanning={scanStatus === 'running' || scanStatus === 'queued'}
                    isPaused={isPaused}
                    scanComplete={scanStatus === 'completed'}
                    progressPct={progressPct}
                    eventPulseTick={eventPulseTick}
                    confirmedFlashTick={confirmedFlashTick}
                    cliLines={spiderCliLines}
                    currentStage={scanStage}
                    requestsSent={requestLogs.length}
                    elapsedFormatted={elapsedFormatted}
                    activeProfile={selectedProfile}
                    onChangeProfile={setSelectedProfile}
                    onQuickStartScan={(prof) => handleStartScan(prof || selectedProfile)}
                    onControlScan={handleControlScan}
                    moduleProbeCounts={moduleProbeCounts}
                    activeProbingModule={activeProbingModule}
                    lastConfirmedModule={lastConfirmedModule}
                    findings={findings}
                    selectedModuleFilter={selectedLegFilter?.modules || null}
                    selectedLegLabel={
                      selectedLegFilter
                        ? `L${selectedLegFilter.legIndex} ${selectedLegFilter.shortLabel}`
                        : null
                    }
                    onToggleLegFilter={setSelectedLegFilter}
                    selectedSeverityFilter={selectedSeverityFilter}
                    onSelectSeverityFilter={setSelectedSeverityFilter}
                    lookDirection={lookDirection}
                    onJumpToTerminal={() => setActiveSection('command_terminal')}
                    onSelectFinding={(fid) => {
                      setSelectedFindingId(fid);
                      setActiveSection('vulnerabilities');
                    }}
                    onDropRetestFinding={handleRetestFinding}
                  />
                </div>
                <div className="lg:col-span-5 flex flex-col gap-3.5">
                  <CommandTerminalPanel
                    logs={commandLogs}
                    onClearLogs={() => setCommandLogs([])}
                    onAppendLog={appendCommandLog}
                    onStartScan={handleStartScan}
                    onRetestFinding={handleRetestFinding}
                    scanStatus={scanStatus}
                    scanStage={scanStage}
                    findings={findings}
                  />
                  <LiveTelemetryPanel
                    pagesCrawled={pagesCrawled}
                    crawlQueue={crawlQueue}
                    endpointsMapped={totalEndpointsCount}
                    checksDone={checksDone}
                    profileId={selectedProfile}
                    requestsPerSecond={rollingRps}
                    scanStatus={scanStatus}
                  />
                </div>
              </div>

              {/* 3. BOTTOM ROW: VULNERABILITY INTEL (5 cols) + EVENT STREAM (4 cols) + RADAR WEB (3 cols) */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
                <div className="lg:col-span-5">
                  <VulnerabilityIntelTable
                    findings={findings}
                    onSelectFinding={(fid) => {
                      setSelectedFindingId(fid);
                      setActiveSection('vulnerabilities');
                    }}
                    onViewAll={() => setActiveSection('vulnerabilities')}
                    onOpenRoadmap={() => setActiveSection('reports')}
                    externalModuleFilter={selectedLegFilter?.modules || null}
                    externalLegLabel={
                      selectedLegFilter
                        ? `L${selectedLegFilter.legIndex} ${selectedLegFilter.shortLabel}`
                        : null
                    }
                    onClearExternalModuleFilter={() => setSelectedLegFilter(null)}
                    externalSeverityFilter={selectedSeverityFilter}
                    onClearExternalSeverityFilter={() => setSelectedSeverityFilter(null)}
                  />
                </div>
                <div className="lg:col-span-4">
                  <SecurityEventStream events={securityEvents} />
                </div>
                <div className="lg:col-span-3">
                  <EndpointRadarWeb
                    endpoints={endpointList}
                    scanRunning={scanStatus === 'running' && !isPaused}
                  />
                </div>
              </div>
            </>
          )}

          {/* SCAN CENTER SUB-VIEW */}
          {activeSection === 'scan_center' && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-purple-500/35 bg-[#07030d]/90 p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold text-white">
                    Scan Center — Profile Configuration & Live Feed
                  </h2>
                  <p className="text-xs text-zinc-400 font-mono mt-0.5">
                    Target: {verifiedTarget.url} · Active Scan ID: {activeScanId || 'None'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {(['safe', 'standard', 'aggressive'] as const).map((prof) => (
                    <button
                      key={prof}
                      onClick={() => setSelectedProfile(prof)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-mono uppercase border transition cursor-pointer ${
                        selectedProfile === prof
                          ? 'bg-purple-600/40 border-purple-400 text-white shadow-[0_0_14px_rgba(168,85,247,0.4)]'
                          : 'bg-black/60 border-purple-500/25 text-zinc-400 hover:text-white'
                      }`}
                    >
                      {PROFILES[prof].label}
                    </button>
                  ))}
                  <button
                    onClick={() => handleStartScan(selectedProfile)}
                    disabled={launchingScan || (scanStatus === 'running' && !isPaused)}
                    className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-500 hover:to-fuchsia-500 disabled:opacity-50 text-xs font-mono font-bold text-white shadow-[0_0_20px_rgba(168,85,247,0.45)] cursor-pointer"
                  >
                    {scanStatus === 'running' ? 'Scan Running...' : 'Start Scan'}
                  </button>
                </div>
              </div>

              <TabLiveScan
                events={sseEvents}
                requestLogs={requestLogs}
                isScanning={scanStatus === 'running'}
                onSelectTriageFinding={(fid: string) => {
                  setSelectedFindingId(fid);
                  setActiveSection('vulnerabilities');
                }}
              />
            </div>
          )}

          {/* VULNERABILITIES (AGENT 4-CARD REASONING) SUB-VIEW */}
          {activeSection === 'vulnerabilities' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-white">
                    Vulnerability Intelligence & 4-Agent Triage Reasoning
                  </h2>
                  <p className="text-xs text-zinc-400 font-mono">
                    Click any finding to inspect Argumenter, Opposer, Rule Check, and Weigher Pros/Cons.
                  </p>
                </div>
                <button
                  onClick={() => setActiveSection('overview')}
                  className="px-3 py-1.5 rounded-xl bg-purple-950/50 border border-purple-500/35 text-xs font-mono text-purple-200 hover:bg-purple-900/50 cursor-pointer"
                >
                  ← Back to Overview
                </button>
              </div>
              <TabAgentReasoning
                triageResults={findings}
                selectedFindingId={selectedFindingId}
                onSelectFindingId={setSelectedFindingId}
                onOpenRoadmap={() => setActiveSection('reports')}
              />
            </div>
          )}

          {/* ENDPOINTS SUB-VIEW */}
          {activeSection === 'endpoints' && (
            <div className="rounded-2xl border border-purple-500/35 bg-[#07030d]/90 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-white">
                  Discovered Attack Surface ({endpointList.length} Endpoints)
                </h2>
                <span className="text-xs font-mono text-purple-300">
                  Scope locked to {targetHost}
                </span>
              </div>
              <div className="divide-y divide-purple-500/15 font-mono text-xs">
                {endpointList.map((ep) => (
                  <div
                    key={ep.url}
                    className="py-2.5 flex items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          ep.status === 'flagged' ? 'bg-red-400' : 'bg-emerald-400'
                        }`}
                      />
                      <span className="text-zinc-200 truncate">{ep.url}</span>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] uppercase border ${
                        ep.status === 'flagged'
                          ? 'bg-red-500/20 text-red-300 border-red-500/40'
                          : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                      }`}
                    >
                      {ep.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* COMMAND TERMINAL FULL VIEW */}
          {activeSection === 'command_terminal' && (
            <CommandTerminalPanel
              logs={commandLogs}
              onClearLogs={() => setCommandLogs([])}
              onAppendLog={appendCommandLog}
              onStartScan={handleStartScan}
              onRetestFinding={handleRetestFinding}
              scanStatus={scanStatus}
              scanStage={scanStage}
              findings={findings}
              expanded
            />
          )}

          {/* ACTIVITY LOGS SUB-VIEW */}
          {activeSection === 'activity_logs' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <SecurityEventStream events={securityEvents} />
              <div className="rounded-2xl border border-purple-500/35 bg-[#07030d]/90 p-4">
                <h3 className="text-sm font-semibold text-white mb-3">
                  HTTP Request Telemetry ({requestLogs.length} requests)
                </h3>
                <div className="max-h-[360px] overflow-y-auto divide-y divide-purple-500/15 font-mono text-xs">
                  {requestLogs.length === 0 ? (
                    <div className="py-8 text-center text-zinc-500">
                      No HTTP requests logged yet.
                    </div>
                  ) : (
                    requestLogs.map((req, i) => (
                      <div key={req.id || i} className="py-2 flex items-center justify-between gap-2">
                        <span className="text-purple-300 font-bold">{req.method}</span>
                        <span className="text-zinc-300 truncate flex-1">{req.url}</span>
                        <span className="text-emerald-400">{req.status ?? 200}</span>
                        <span className="text-zinc-500">{req.ts}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* REPORTS & REMEDIATION ROADMAP SUB-VIEW */}
          {activeSection === 'reports' && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-purple-500/35 bg-[#07030d]/90 p-5 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-white">
                    Remediation Roadmap & Exportable Reports
                  </h2>
                  <p className="text-xs text-zinc-400 font-mono">
                    Dependency-ordered fix graph and machine-readable security artifacts.
                  </p>
                </div>
                {activeScanId && (
                  <div className="flex items-center gap-2">
                    <a
                      href={`/api/v2/scans/${activeScanId}/roadmap`}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-1.5 rounded-xl bg-purple-600/30 border border-purple-400/50 text-xs font-mono text-white flex items-center gap-1.5 hover:bg-purple-600/50"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Export JSON</span>
                    </a>
                    <a
                      href={`/api/v2/scans/${activeScanId}/requests`}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-1.5 rounded-xl bg-purple-600/30 border border-purple-400/50 text-xs font-mono text-white flex items-center gap-1.5 hover:bg-purple-600/50"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Export HTTP Log</span>
                    </a>
                  </div>
                )}
              </div>

              <RoadmapTree
                nodes={roadmapNodes}
                onSelectNode={(node: RoadmapNode) => setSelectedRoadmapNode(node)}
                onOpenDebater={() => setActiveSection('vulnerabilities')}
              />
              {selectedRoadmapNode && (
                <RoadmapDrawer
                  node={selectedRoadmapNode}
                  onClose={() => setSelectedRoadmapNode(null)}
                  onNodeFixed={(nodeId, findingId, newScore) => {
                    if (typeof newScore === 'number') {
                      setRiskScore(newScore);
                    }
                    setRoadmapNodes((prev) =>
                      prev.map((n) => (n.id === nodeId ? { ...n, status: 'fixed' } : n))
                    );
                    pushSecurityEvent(`Verified fix for ${findingId}`, 'emerald');
                  }}
                />
              )}
            </div>
          )}

          {/* SETTINGS SUB-VIEW */}
          {activeSection === 'settings' && (
            <div className="rounded-2xl border border-purple-500/35 bg-[#07030d]/90 p-6 space-y-4 max-w-2xl">
              <h2 className="text-lg font-bold text-white">Platform Settings</h2>
              <div className="space-y-3 text-xs font-mono">
                <div className="flex items-center justify-between p-3 rounded-xl bg-black/60 border border-purple-500/25">
                  <span>Verified Target URL</span>
                  <span className="text-purple-300">{verifiedTarget.url}</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-xl bg-black/60 border border-purple-500/25">
                  <span>Default Scan Profile</span>
                  <span className="text-purple-300 uppercase">{selectedProfile}</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-xl bg-black/60 border border-purple-500/25">
                  <span>Backend Engine Health</span>
                  <span className={engineOnline ? 'text-emerald-400' : 'text-red-400'}>
                    {engineOnline ? 'ONLINE' : 'OFFLINE'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* HELP & DOCS SUB-VIEW */}
          {activeSection === 'help_docs' && (
            <div className="rounded-2xl border border-purple-500/35 bg-[#07030d]/90 p-6 space-y-3 max-w-2xl">
              <h2 className="text-lg font-bold text-white">
                NikSpider v3.0 — Command Reference
              </h2>
              <p className="text-xs text-zinc-300">
                Use the Command Terminal on the Overview dashboard to trigger scans, inspect findings, and verify patches:
              </p>
              <pre className="p-4 rounded-xl bg-black border border-purple-500/30 font-mono text-xs text-purple-300 space-y-1">
                {`scan start --profile=safe|standard|aggressive
scan status
findings list
findings list --severity=critical|high|medium|low
retest <finding_id>
clear`}
              </pre>
            </div>
          )}
        </main>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          GLOBAL SEARCH PALETTE MODAL (Ctrl + K)
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
                onClick={() => setSearchOpen(false)}
                className="text-zinc-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 max-h-80 overflow-y-auto space-y-4 text-xs">
              <div>
                <div className="text-[10px] font-mono uppercase text-purple-300 mb-2">
                  Matching Findings ({searchResults.matchedFindings.length})
                </div>
                {searchResults.matchedFindings.length === 0 ? (
                  <div className="text-zinc-500 font-mono">No matching findings.</div>
                ) : (
                  <div className="space-y-1.5">
                    {searchResults.matchedFindings.map((f) => (
                      <button
                        key={f.id}
                        onClick={() => {
                          setSelectedFindingId(f.id);
                          setActiveSection('vulnerabilities');
                          setSearchOpen(false);
                        }}
                        className="w-full p-2 rounded-lg bg-black/60 hover:bg-purple-500/15 border border-purple-500/20 flex items-center justify-between text-left cursor-pointer"
                      >
                        <span className="text-white font-medium truncate">
                          [{f.severity}] {f.module || f.owasp}
                        </span>
                        <span className="text-zinc-400 font-mono truncate max-w-[180px]">
                          {f.url}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <div className="text-[10px] font-mono uppercase text-purple-300 mb-2">
                  Matching Endpoints ({searchResults.matchedEndpoints.length})
                </div>
                {searchResults.matchedEndpoints.length === 0 ? (
                  <div className="text-zinc-500 font-mono">No matching endpoints.</div>
                ) : (
                  <div className="space-y-1">
                    {searchResults.matchedEndpoints.map((ep) => (
                      <button
                        key={ep.url}
                        onClick={() => {
                          setActiveSection('endpoints');
                          setSearchOpen(false);
                        }}
                        className="w-full p-2 rounded-lg bg-black/60 hover:bg-purple-500/15 border border-purple-500/20 flex items-center justify-between text-left font-mono cursor-pointer"
                      >
                        <span className="text-zinc-200 truncate">{ep.url}</span>
                        <span className="text-purple-300 uppercase text-[10px]">
                          {ep.status}
                        </span>
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
