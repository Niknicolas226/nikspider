import { useState, useEffect, useCallback, useRef } from 'react';
import { ScanSocketEvent, TerminalLineItem } from '../../types';
import { connectScanSocket, runSimulatedSocketStream } from '../../api/socket';

function formatSocketEventToLine(ev: ScanSocketEvent, idx: number): TerminalLineItem {
  const id = `${ev.ts}-${idx}-${ev.type}`;
  const stage = ev.stage ?? '0';

  if (ev.type === 'connected') {
    return {
      id,
      ts: ev.ts,
      stage,
      prefix: '>',
      tone: 'prompt',
      text: ev.message || '> nikspider scan ~',
      module: ev.module,
      endpoint: ev.endpoint,
      severity: ev.severity,
    };
  }

  if (ev.type === 'probe_started' || ev.type === 'reprobing' || ev.type === 'stage_started') {
    const defaultMsg =
      ev.type === 'reprobing'
        ? `→ Re-probing for confirmation (1/2) on ${ev.endpoint || ''}`
        : `→ Running probe: ${ev.module || 'check'} on ${ev.endpoint || '/'}`;
    return {
      id,
      ts: ev.ts,
      stage,
      prefix: '→',
      tone: 'info',
      text: ev.message || defaultMsg,
      module: ev.module,
      endpoint: ev.endpoint,
      severity: ev.severity,
    };
  }

  if (ev.type === 'signal') {
    return {
      id,
      ts: ev.ts,
      stage,
      prefix: '⚠',
      tone: 'warning',
      text:
        ev.message ||
        `⚠ Signal: ${(ev.module || 'probe').toUpperCase()} differential detected on ${ev.endpoint || '/'} (${
          ev.severity || 'medium'
        } confidence)`,
      module: ev.module,
      endpoint: ev.endpoint,
      severity: ev.severity,
    };
  }

  if (ev.type === 'confirmed') {
    const sevTag = (ev.severity || 'high').toUpperCase();
    return {
      id,
      ts: ev.ts,
      stage,
      prefix: '✓',
      tone: 'confirmed',
      text: ev.message || `✓ CONFIRMED: ${(ev.module || 'VULN').toUpperCase()} — ${ev.endpoint || '/'} [${sevTag}]`,
      module: ev.module,
      endpoint: ev.endpoint,
      severity: ev.severity || 'high',
    };
  }

  if (ev.type === 'rejected') {
    return {
      id,
      ts: ev.ts,
      stage,
      prefix: '✗',
      tone: 'danger',
      text: ev.message || `✗ REJECTED: ${(ev.module || 'CHECK').toUpperCase()} — ${ev.endpoint || '/'} (false positive)`,
      module: ev.module,
      endpoint: ev.endpoint,
      severity: null,
    };
  }

  return {
    id,
    ts: ev.ts,
    stage,
    prefix: '✓',
    tone: ev.type === 'scan_complete' ? 'confirmed' : 'success',
    text: ev.message || `✓ Stage ${stage}: ${ev.type}`,
    module: ev.module,
    endpoint: ev.endpoint,
    severity: ev.severity,
  };
}

export function useLiveScanSocket(scanId: string | null) {
  const [lines, setLines] = useState<TerminalLineItem[]>([]);
  const [connected, setConnected] = useState<boolean>(false);
  const [currentStage, setCurrentStage] = useState<number>(0);
  const [isComplete, setIsComplete] = useState<boolean>(false);
  const counterRef = useRef(0);
  const simCleanupRef = useRef<(() => void) | null>(null);

  const appendEvent = useCallback((ev: ScanSocketEvent) => {
    counterRef.current += 1;
    const line = formatSocketEventToLine(ev, counterRef.current);
    setLines((prev) => [...prev, line]);

    const parsedStage = parseInt(ev.stage, 10);
    if (!Number.isNaN(parsedStage)) {
      setCurrentStage((prev) => Math.max(prev, parsedStage));
    }
    if (ev.type === 'scan_complete') {
      setCurrentStage(6);
      setIsComplete(true);
    }
  }, []);

  const replayDemoStream = useCallback(() => {
    if (simCleanupRef.current) {
      simCleanupRef.current();
    }
    setLines([]);
    setCurrentStage(0);
    setIsComplete(false);
    counterRef.current = 0;
    simCleanupRef.current = runSimulatedSocketStream(appendEvent, setConnected, 320);
  }, [appendEvent]);

  useEffect(() => {
    setLines([]);
    setCurrentStage(0);
    setIsComplete(false);
    counterRef.current = 0;

    const cleanup = connectScanSocket(scanId, appendEvent, setConnected);
    return () => {
      cleanup();
      if (simCleanupRef.current) {
        simCleanupRef.current();
      }
    };
  }, [scanId, appendEvent]);

  return {
    lines,
    connected,
    currentStage,
    isComplete,
    replayDemoStream,
    clearLines: () => setLines([]),
  };
}

