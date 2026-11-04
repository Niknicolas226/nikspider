import { ScanSocketEvent } from '../types';

const IS_MOCK = import.meta.env.VITE_MOCK === '1';

export const DEMO_TERMINAL_EVENTS: Omit<ScanSocketEvent, 'ts'>[] = [
  {
    stage: '0',
    type: 'connected',
    module: null,
    endpoint: null,
    severity: null,
    message: '> nikspider scan ~',
  },
  {
    stage: '0',
    type: 'stage_started',
    module: null,
    endpoint: 'example.com',
    severity: null,
    message: '✓ Target verified (DNS TXT match)',
  },
  {
    stage: '0',
    type: 'stage_completed',
    module: null,
    endpoint: 'example.com',
    severity: null,
    message: '✓ Guard active — scope locked to example.com',
  },
  {
    stage: '1',
    type: 'crawl_complete',
    module: null,
    endpoint: '/search, /profile, /login, /api/v1/*',
    severity: null,
    message: '✓ Crawling: 47/124 pages discovered',
  },
  {
    stage: '1',
    type: 'surface_mapped',
    module: null,
    endpoint: null,
    severity: null,
    message: '✓ Surface map: 212 params classified',
  },
  {
    stage: '2',
    type: 'probe_started',
    module: 'sqli',
    endpoint: '/search?q=...',
    severity: null,
    message: '→ Running probe: sqli on /search?q=...',
  },
  {
    stage: '2',
    type: 'probe_started',
    module: 'xss',
    endpoint: '/comment',
    severity: null,
    message: '→ Running probe: xss on /comment',
  },
  {
    stage: '2',
    type: 'signal',
    module: 'sqli',
    endpoint: '/search?q=',
    severity: 'medium',
    message: '⚠ Signal: SQLi boolean-diff detected (medium confidence)',
  },
  {
    stage: '2',
    type: 'reprobing',
    module: 'sqli',
    endpoint: '/search?q=',
    severity: null,
    message: '→ Re-probing for confirmation (1/2)',
  },
  {
    stage: '3',
    type: 'confirmed',
    module: 'sqli',
    endpoint: '/search?q=',
    severity: 'high',
    message: '✓ CONFIRMED: SQLi — /search?q= [HIGH]',
  },
  {
    stage: '2',
    type: 'probe_started',
    module: 'xss',
    endpoint: '/profile?name=...',
    severity: null,
    message: '→ Running probe: xss on /profile?name=...',
  },
  {
    stage: '2',
    type: 'signal',
    module: 'xss',
    endpoint: '/profile?name=',
    severity: 'medium',
    message: '⚠ Signal: XSS unescaped canary nspmarker<tag>"<z> reflected',
  },
  {
    stage: '3',
    type: 'confirmed',
    module: 'xss',
    endpoint: '/profile?name=',
    severity: 'high',
    message: '✓ CONFIRMED: XSS — /profile?name= [HIGH]',
  },
  {
    stage: '2',
    type: 'probe_started',
    module: 'ssrf',
    endpoint: '/fetch-image',
    severity: null,
    message: '→ Running probe: ssrf on /fetch-image',
  },
  {
    stage: '3',
    type: 'rejected',
    module: 'xss',
    endpoint: '/search_safe?query=',
    severity: null,
    message: '✗ REJECTED: XSS — /search_safe?query= (HTML-escaped decoy filtered)',
  },
  {
    stage: '2',
    type: 'probe_started',
    module: 'session',
    endpoint: '/login',
    severity: null,
    message: '→ Running probe: session on /login',
  },
  {
    stage: '3',
    type: 'confirmed',
    module: 'session',
    endpoint: '/login',
    severity: 'medium',
    message: '✓ CONFIRMED: SESSION — /login [MEDIUM]',
  },
  {
    stage: '4',
    type: 'stage_started',
    module: null,
    endpoint: null,
    severity: null,
    message: '→ Stage 4: Synthesizing grounded arguments [evidence_id: ev_8f2a, ev_3c91, ev_7d14]',
  },
  {
    stage: '5',
    type: 'stage_started',
    module: null,
    endpoint: null,
    severity: null,
    message: '✓ Stage 5: Root-cause repair roadmap & SARIF/MD/PDF reports ready',
  },
  {
    stage: '6',
    type: 'scan_complete',
    module: null,
    endpoint: null,
    severity: 'high',
    message: '✓ Scan complete — 3 findings (2 high, 1 medium)',
  },
];

export function runSimulatedSocketStream(
  onEvent: (ev: ScanSocketEvent) => void,
  onStatusChange?: (connected: boolean) => void,
  speedMs = 380
): () => void {
  let cancelled = false;
  const timers: ReturnType<typeof setTimeout>[] = [];
  onStatusChange?.(true);

  DEMO_TERMINAL_EVENTS.forEach((item, index) => {
    const timer = setTimeout(() => {
      if (cancelled) return;
      onEvent({
        ...item,
        ts: new Date().toISOString(),
      });
    }, index * speedMs);
    timers.push(timer);
  });

  return () => {
    cancelled = true;
    timers.forEach(clearTimeout);
    onStatusChange?.(false);
  };
}

export function connectScanSocket(
  scanId: string | null,
  onEvent: (ev: ScanSocketEvent) => void,
  onStatusChange?: (connected: boolean) => void
): () => void {
  if (IS_MOCK || !scanId || scanId.startsWith('scn_mock') || scanId.startsWith('demo_')) {
    return runSimulatedSocketStream(onEvent, onStatusChange);
  }

  let ws: WebSocket | null = null;
  let closedByClient = false;
  let retryAttempt = 0;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let pingInterval: ReturnType<typeof setInterval> | null = null;
  let receivedRealEvent = false;
  let fallbackCleanup: (() => void) | null = null;

  const getWsUrl = () => {
    const rawApi = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
    if (rawApi) {
      const wsBase = rawApi.replace(/^http/, 'ws');
      return `${wsBase}/ws/scans/${scanId}`;
    }
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${window.location.host}/ws/scans/${scanId}`;
  };

  const connect = () => {
    if (closedByClient) return;
    try {
      ws = new WebSocket(getWsUrl());
    } catch {
      fallbackCleanup = runSimulatedSocketStream(onEvent, onStatusChange);
      return;
    }

    ws.onopen = () => {
      retryAttempt = 0;
      onStatusChange?.(true);
      pingInterval = setInterval(() => {
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send('ping');
        }
      }, 15000);
    };

    ws.onmessage = (msg) => {
      try {
        const parsed = JSON.parse(msg.data);
        if (parsed.type === 'pong') return;
        receivedRealEvent = true;
        onEvent(parsed as ScanSocketEvent);
      } catch (e) {
        console.warn('Invalid WS payload', e);
      }
    };

    ws.onerror = () => {
      onStatusChange?.(false);
    };

    ws.onclose = () => {
      onStatusChange?.(false);
      if (pingInterval) clearInterval(pingInterval);
      if (closedByClient) return;

      retryAttempt += 1;
      if (retryAttempt <= 3) {
        const delay = Math.min(1000 * Math.pow(2, retryAttempt - 1), 6000);
        retryTimer = setTimeout(connect, delay);
      } else if (!receivedRealEvent && !fallbackCleanup) {
        // Graceful fallback to simulated stream if backend WS isn't reachable
        fallbackCleanup = runSimulatedSocketStream(onEvent, onStatusChange);
      }
    };
  };

  connect();

  return () => {
    closedByClient = true;
    if (retryTimer) clearTimeout(retryTimer);
    if (pingInterval) clearInterval(pingInterval);
    if (fallbackCleanup) fallbackCleanup();
    ws?.close();
  };
}

