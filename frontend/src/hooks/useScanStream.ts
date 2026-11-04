import { useEffect, useRef, useCallback } from 'react';
import {
  scanStore,
  useScanStore,
  getInitialStepFromHash,
  parseHashRoute,
} from '../store/scanStore';
import {
  getRoadmap,
  getRequestLogs,
  checkBackendHealth,
} from '../api/client';
import { SSEEvent } from '../types';
import { StepId } from '../config/steps';

const RAW_API_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
const API_BASE = import.meta.env.DEV ? '/api/v2' : `${RAW_API_URL || 'http://localhost:8000'}/api/v2`;

export function useScanStream() {
  const scanId = useScanStore((s) => s.scanId);
  const scanStatus = useScanStore((s) => s.scanStatus);
  const scanStartedAt = useScanStore((s) => s.scanStartedAt);
  const scanCompletedAt = useScanStore((s) => s.scanCompletedAt);
  const furthestStep = useScanStore((s) => s.furthestStep);
  const currentStep = useScanStore((s) => s.currentStep);

  const seenEventIdsRef = useRef<Set<string>>(new Set());
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectAttemptRef = useRef<number>(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isIntentionalCloseRef = useRef<boolean>(false);

  // ═══════════════════════════════════════════════════════════════════
  // 1. URL HASH SYNC (Forward & Backward Navigation via #/scan/:id/step/X or #/step/X)
  // ═══════════════════════════════════════════════════════════════════
  useEffect(() => {
    const handleHashChange = () => {
      const { scanId: hashScanId } = parseHashRoute();
      if (hashScanId && !scanStore.getState().scanId) {
        scanStore.dispatch({
          type: 'START_SCAN_SUCCESS',
          payload: { scanId: hashScanId },
        });
      }
      const targetStep = getInitialStepFromHash(scanStore.getState().furthestStep);
      if (targetStep !== scanStore.getState().currentStep) {
        scanStore.dispatch({ type: 'GO_TO_STEP', payload: targetStep });
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    // Initial sync
    handleHashChange();

    return () => {
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, []);

  // Sync state changes to hash
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const activeScanId = scanStore.getState().scanId;
      const currentHash = window.location.hash;
      const expectedHash = activeScanId
        ? `#/scan/${activeScanId}/step/${currentStep}`
        : `#/step/${currentStep}`;
      if (currentHash !== expectedHash) {
        window.history.replaceState(null, '', expectedHash);
      }
    }
  }, [currentStep, scanId]);

  // ═══════════════════════════════════════════════════════════════════
  // 2. LIVE DURATION TIMER (starts at scan start, stops at roadmap_ready)
  // ═══════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (!scanStartedAt || scanStatus !== 'running') {
      return;
    }

    const interval = setInterval(() => {
      const now = scanCompletedAt || Date.now();
      const elapsed = Math.max(0, Math.floor((now - scanStartedAt) / 1000));
      scanStore.dispatch({ type: 'UPDATE_DURATION', payload: elapsed });
    }, 1000);

    return () => clearInterval(interval);
  }, [scanStartedAt, scanStatus, scanCompletedAt]);

  // ═══════════════════════════════════════════════════════════════════
  // 3. RECONCILIATION HELPER: FETCH ROADMAP & REQUESTS AFTER DISCONNECT
  // ═══════════════════════════════════════════════════════════════════
  const reconcileSnapshot = useCallback(async (activeScanId: string) => {
    try {
      const [rm, reqs] = await Promise.all([
        getRoadmap(activeScanId).catch(() => null),
        getRequestLogs(activeScanId).catch(() => null),
      ]);
      if (rm && rm.nodes) {
        scanStore.dispatch({ type: 'SET_ROADMAP', payload: rm });
      }
      if (reqs && Array.isArray(reqs)) {
        scanStore.dispatch({ type: 'SET_REQUESTS', payload: reqs });
      }
    } catch {
      // non-fatal
    }
  }, []);

  // ═══════════════════════════════════════════════════════════════════
  // 4. SSE STREAM SUBSCRIPTION WITH RESILIENT EXPONENTIAL BACKOFF
  // ═══════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (!scanId) {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      scanStore.dispatch({ type: 'SET_SSE_STATUS', payload: 'disconnected' });
      return;
    }

    // On reload/resume with existing scanId: fetch initial snapshot
    reconcileSnapshot(scanId);

    isIntentionalCloseRef.current = false;

    function connectSSE() {
      if (isIntentionalCloseRef.current) return;

      const url = `${API_BASE}/scans/${encodeURIComponent(scanId!)}/stream`;
      const es = new EventSource(url);
      eventSourceRef.current = es;

      es.onopen = () => {
        reconnectAttemptRef.current = 0;
        scanStore.dispatch({ type: 'SET_SSE_STATUS', payload: 'connected' });
        scanStore.dispatch({ type: 'SET_BACKEND_ONLINE', payload: true });
        reconcileSnapshot(scanId!);
      };

      es.onmessage = (event) => {
        try {
          const raw = event.data;
          if (!raw) return;
          const parsed = JSON.parse(raw) as SSEEvent;

          // Deduplication check
          const eventUniqueKey =
            (parsed as any).id ||
            `${parsed.type}:${(parsed as any).url || ''}:${(parsed as any).module || ''}:${(parsed as any).pages || ''}:${(parsed as any).score || ''}`;

          if (seenEventIdsRef.current.has(eventUniqueKey)) {
            return;
          }
          seenEventIdsRef.current.add(eventUniqueKey);

          scanStore.dispatch({ type: 'SSE_EVENT', payload: parsed });

          // Reconcile snapshot if roadmap or crawl progresses
          if (parsed.type === 'roadmap_ready') {
            reconcileSnapshot(scanId!);
            isIntentionalCloseRef.current = true;
            es.close();
            scanStore.dispatch({ type: 'SET_SSE_STATUS', payload: 'disconnected' });
          }
        } catch (err) {
          console.error('[SSE] JSON parse error', err);
        }
      };

      es.onerror = () => {
        if (isIntentionalCloseRef.current) return;
        es.close();
        eventSourceRef.current = null;

        scanStore.dispatch({ type: 'SET_SSE_STATUS', payload: 'reconnecting' });

        const attempt = reconnectAttemptRef.current;
        reconnectAttemptRef.current += 1;

        // Exponential backoff: 1s, 2s, 4s, up to 15s max
        const delay = Math.min(1000 * Math.pow(2, attempt), 15000);

        if (reconnectTimerRef.current) {
          clearTimeout(reconnectTimerRef.current);
        }

        reconnectTimerRef.current = setTimeout(() => {
          connectSSE();
        }, delay);
      };
    }

    connectSSE();

    return () => {
      isIntentionalCloseRef.current = true;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      scanStore.dispatch({ type: 'SET_SSE_STATUS', payload: 'disconnected' });
    };
  }, [scanId, reconcileSnapshot]);

  // ═══════════════════════════════════════════════════════════════════
  // 5. BACKEND ENGINE HEALTH MONITOR (polls every 15s)
  // ═══════════════════════════════════════════════════════════════════
  const checkHealth = useCallback(async () => {
    try {
      const res = await checkBackendHealth();
      scanStore.dispatch({ type: 'SET_BACKEND_ONLINE', payload: res.online });
    } catch {
      scanStore.dispatch({ type: 'SET_BACKEND_ONLINE', payload: false });
    }
  }, []);

  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, 15000);
    return () => clearInterval(interval);
  }, [checkHealth]);

  return {
    scanId,
    scanStatus,
    furthestStep,
    currentStep,
    recheckHealth: checkHealth,
  };
}
