"""WebSocket event bus for real-time Stage 0→6 scan telemetry.

Broadcasts structured scan events to connected WebSocket clients:
{
  "ts": "2026-11-04T16:00:00Z",
  "stage": "2",
  "type": "probe_started|signal|reprobing|confirmed|rejected|stage_status|scan_complete",
  "module": "sqli",
  "endpoint": "/search?q=...",
  "severity": null | "low|medium|high|critical",
  "message": "..."
}
"""

import asyncio
import json
from collections import defaultdict
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

ws_router = APIRouter()


class ScanWebSocketManager:
    """Manages active WebSocket connections and per-scan event replay buffers."""

    def __init__(self) -> None:
        self._connections: dict[str, set[WebSocket]] = defaultdict(set)
        self._history: dict[str, list[dict[str, Any]]] = defaultdict(list)

    async def connect(self, websocket: WebSocket, scan_id: str = "*") -> None:
        await websocket.accept()
        self._connections[scan_id].add(websocket)
        # Send initial connected handshake
        await websocket.send_text(
            json.dumps({
                "ts": datetime.now(timezone.utc).isoformat(),
                "stage": "0",
                "type": "connected",
                "scan_id": scan_id,
                "module": None,
                "endpoint": None,
                "severity": None,
                "message": f"> nikspider scan ~ (session {scan_id[:8] if scan_id != '*' else 'live'})",
            })
        )
        # Replay buffered events for this scan_id so late subscribers see full terminal output
        if scan_id in self._history:
            for ev in list(self._history[scan_id]):
                try:
                    await websocket.send_text(json.dumps(ev, default=str))
                except Exception:
                    break

    def disconnect(self, websocket: WebSocket, scan_id: str = "*") -> None:
        if scan_id in self._connections:
            self._connections[scan_id].discard(websocket)

    def get_history(self, scan_id: str) -> list[dict[str, Any]]:
        return list(self._history.get(scan_id, []))

    async def broadcast(self, scan_id: str, event: dict[str, Any]) -> None:
        if "ts" not in event:
            event["ts"] = datetime.now(timezone.utc).isoformat()
        if "scan_id" not in event:
            event["scan_id"] = scan_id

        if scan_id:
            self._history[scan_id].append(event)
            # Cap history at 500 events per scan
            if len(self._history[scan_id]) > 500:
                self._history[scan_id] = self._history[scan_id][-500:]

        payload = json.dumps(event, default=str)
        targets = set(self._connections.get(scan_id, set())) | set(self._connections.get("*", set()))
        dead: list[tuple[str, WebSocket]] = []

        for ws in targets:
            try:
                await ws.send_text(payload)
            except Exception:
                dead.append((scan_id, ws))

        for sid, ws in dead:
            self._connections[sid].discard(ws)
            self._connections["*"].discard(ws)


ws_manager = ScanWebSocketManager()


def emit_event_sync(
    scan_id: str,
    stage: str,
    event_type: str,
    module: str | None = None,
    endpoint: str | None = None,
    severity: str | None = None,
    message: str | None = None,
    extra: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Emit a scan event from synchronous or asynchronous code."""
    event: dict[str, Any] = {
        "ts": datetime.now(timezone.utc).isoformat(),
        "scan_id": scan_id or "global",
        "stage": str(stage),
        "type": event_type,
        "module": module,
        "endpoint": endpoint,
        "severity": severity.lower() if isinstance(severity, str) else None,
    }
    if message:
        event["message"] = message
    if extra:
        event.update(extra)

    try:
        loop = asyncio.get_running_loop()
        loop.create_task(ws_manager.broadcast(scan_id or "global", event))
    except RuntimeError:
        # No running event loop (e.g., unit test) — still record in history
        ws_manager._history[scan_id or "global"].append(event)

    return event


async def emit_event(
    scan_id: str,
    stage: str,
    event_type: str,
    module: str | None = None,
    endpoint: str | None = None,
    severity: str | None = None,
    message: str | None = None,
    extra: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Async emit helper."""
    event: dict[str, Any] = {
        "ts": datetime.now(timezone.utc).isoformat(),
        "scan_id": scan_id or "global",
        "stage": str(stage),
        "type": event_type,
        "module": module,
        "endpoint": endpoint,
        "severity": severity.lower() if isinstance(severity, str) else None,
    }
    if message:
        event["message"] = message
    if extra:
        event.update(extra)

    await ws_manager.broadcast(scan_id or "global", event)
    return event


@ws_router.websocket("/ws/scans/{scan_id}")
async def websocket_scan_endpoint(websocket: WebSocket, scan_id: str):
    await ws_manager.connect(websocket, scan_id)
    try:
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text(json.dumps({"type": "pong", "ts": datetime.now(timezone.utc).isoformat()}))
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket, scan_id)
    except Exception:
        ws_manager.disconnect(websocket, scan_id)


@ws_router.websocket("/api/v2/ws/scans/{scan_id}")
async def websocket_scan_v2_endpoint(websocket: WebSocket, scan_id: str):
    await ws_manager.connect(websocket, scan_id)
    try:
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text(json.dumps({"type": "pong", "ts": datetime.now(timezone.utc).isoformat()}))
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket, scan_id)
    except Exception:
        ws_manager.disconnect(websocket, scan_id)


@ws_router.websocket("/ws")
async def websocket_global_endpoint(websocket: WebSocket):
    await ws_manager.connect(websocket, "*")
    try:
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text(json.dumps({"type": "pong", "ts": datetime.now(timezone.utc).isoformat()}))
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket, "*")
    except Exception:
        ws_manager.disconnect(websocket, "*")

