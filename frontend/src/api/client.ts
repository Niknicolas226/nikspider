import { Target, RoadmapResponse, RequestLogEntry, SSEEvent, ScanProfile, RetestApiResult } from '../types';

const RAW_API_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
const API_BASE = import.meta.env.DEV ? '/api/v2' : `${RAW_API_URL || 'http://localhost:8000'}/api/v2`;

export interface HealthResponse {
  online: boolean;
  demoMode: boolean;
  time?: string;
}

export interface ScanHistoryPoint {
  id: string;
  risk_score: number;
  raw_count: number;
  confirmed_count: number;
  high_severity_count?: number;
  endpoints_count?: number;
  duration_seconds?: number;
  started_at: string;
}

export async function checkBackendHealth(): Promise<HealthResponse> {
  try {
    const res = await fetch(`${API_BASE}/health`, { method: 'GET' });
    if (!res.ok) {
      return { online: false, demoMode: false };
    }
    const data = await res.json();
    return {
      online: data.status === 'ok',
      demoMode: Boolean(data.demo_mode),
      time: data.time,
    };
  } catch {
    return { online: false, demoMode: false };
  }
}

export async function getTargetHistory(targetId: string): Promise<ScanHistoryPoint[]> {
  try {
    const res = await fetch(`${API_BASE}/targets/${encodeURIComponent(targetId)}/history`);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.history) ? data.history : [];
  } catch {
    return [];
  }
}

export async function createTarget(url: string): Promise<Target> {
  const res = await fetch(`${API_BASE}/targets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to create target' }));
    throw new Error(err.detail || 'Failed to create target');
  }
  const data = await res.json();
  return { id: data.id, url: data.url || url, token: data.token, verified: Boolean(data.verified) };
}

export async function verifyTarget(targetId: string): Promise<boolean> {
  const res = await fetch(`${API_BASE}/targets/${encodeURIComponent(targetId)}/verify`, {
    method: 'POST',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Verification request failed' }));
    throw new Error(err.detail || 'Verification request failed');
  }
  const data = await res.json();
  return Boolean(data.verified);
}

export async function startScan(targetId: string, profile: ScanProfile = 'standard'): Promise<string> {
  const res = await fetch(`${API_BASE}/scans`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ target_id: targetId, profile }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to start scan' }));
    throw new Error(err.detail || 'Scan request failed');
  }
  const data = await res.json();
  return data.id || data.scan_id;
}

export function subscribeScanSSE(
  scanId: string,
  onEvent: (event: SSEEvent) => void,
  onError: (err: unknown) => void
): () => void {
  let reconnectCount = 0;
  let reconnectDelay = 1000;
  let es: EventSource | null = null;
  let isClosed = false;

  function connect() {
    es = new EventSource(`${API_BASE}/scans/${encodeURIComponent(scanId)}/stream`);

    es.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data) as SSEEvent;
        reconnectCount = 0;
        reconnectDelay = 1000;
        onEvent(parsed);
        if (parsed.type === 'roadmap_ready' || parsed.type === 'error') {
          isClosed = true;
          es?.close();
        }
      } catch (err) {
        console.error('Failed to parse SSE data', err);
      }
    };

    es.onerror = (err) => {
      if (isClosed) return;
      reconnectCount++;
      es?.close();
      if (reconnectCount > 5) {
        isClosed = true;
        onError(err);
        return;
      }
      const delay = Math.min(reconnectDelay * Math.pow(2, reconnectCount - 1), 30000);
      setTimeout(connect, delay);
    };
  }

  connect();

  return () => {
    isClosed = true;
    es?.close();
  };
}

export async function getRoadmap(scanId: string): Promise<RoadmapResponse> {
  const res = await fetch(`${API_BASE}/scans/${encodeURIComponent(scanId)}/roadmap`);
  if (!res.ok) {
    throw new Error('Failed to fetch roadmap');
  }
  return (await res.json()) as RoadmapResponse;
}

export async function getRequestLogs(scanId: string): Promise<RequestLogEntry[]> {
  const res = await fetch(`${API_BASE}/scans/${encodeURIComponent(scanId)}/requests`);
  if (!res.ok) {
    return [];
  }
  return (await res.json()) as RequestLogEntry[];
}

export async function retestFindingDetailed(findingId: string): Promise<RetestApiResult> {
  const res = await fetch(`${API_BASE}/findings/${encodeURIComponent(findingId)}/retest`, {
    method: 'POST',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Retest request failed' }));
    throw new Error(err.detail || 'Retest request failed');
  }
  const data = await res.json();
  return {
    passed: Boolean(data.passed),
    status: data.status || (data.passed ? 'fixed' : 'open'),
    message:
      data.message ||
      (data.passed
        ? 'Live probe re-execution confirmed the vulnerability is remediated.'
        : 'Live probe re-execution still detected the vulnerability signal on the target.'),
    score: typeof data.score === 'number' ? data.score : undefined,
  };
}

export async function retestFinding(findingId: string): Promise<boolean> {
  const res = await retestFindingDetailed(findingId);
  return res.passed;
}

export async function getNodePrompt(nodeId: string): Promise<string> {
  const res = await fetch(`${API_BASE}/nodes/${encodeURIComponent(nodeId)}/prompt`, {
    method: 'POST',
  });
  if (!res.ok) {
    throw new Error('Failed to generate prompt');
  }
  const data = await res.json();
  return data.prompt;
}

export async function controlScan(
  scanId: string,
  action: 'pause' | 'resume' | 'stop'
): Promise<{ scan_id: string; status: string }> {
  const res = await fetch(`${API_BASE}/scans/${encodeURIComponent(scanId)}/control`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action }),
  });
  if (!res.ok) {
    throw new Error(`Failed to ${action} scan`);
  }
  return await res.json();
}

export async function askSpiderAssistant(
  scanId: string,
  question: string
): Promise<{ answer: string; grounded_count: number }> {
  const res = await fetch(`${API_BASE}/scans/${encodeURIComponent(scanId)}/ask`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question }),
  });
  if (!res.ok) {
    throw new Error('Failed to query Spider AI assistant');
  }
  return await res.json();
}
