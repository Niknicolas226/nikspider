"""Policy gate — enforced before every probe request.

Checks:
  - Request budget remaining
  - Circuit breaker (consecutive 5xx threshold)
  - Role availability for auth-requiring probes
"""

from datetime import datetime, timezone
from typing import Any


class PolicyGate:
    """Policy enforcement gate with circuit breaker."""

    def __init__(
        self,
        max_requests: int = 500,
        circuit_breaker_threshold: int = 5,
        circuit_breaker_cooldown_sec: int = 300,
        scan_id: str | None = None,
    ):
        self.max_requests = max_requests
        self.request_count = 0
        self.consecutive_5xx = 0
        self.circuit_breaker_threshold = circuit_breaker_threshold
        self.circuit_breaker_cooldown_sec = circuit_breaker_cooldown_sec
        self._last_5xx_ts: str | None = None
        self.scan_id = scan_id or ""

    def emit_probe(self, module: str, endpoint: str, scan_id: str | None = None) -> None:
        """Emit a Stage 2 probe_started event over WebSocket."""
        try:
            from api.websocket import emit_event_sync
            emit_event_sync(
                scan_id=scan_id or self.scan_id,
                stage="2",
                event_type="probe_started",
                module=module,
                endpoint=endpoint,
                severity=None,
                message=f"→ Running probe: {module} on {endpoint}",
            )
        except Exception:
            pass

    def check(self) -> tuple[bool, str]:
        """Return (allowed, reason)."""
        if self.request_count >= self.max_requests:
            return False, "Request budget exhausted"

        if self.consecutive_5xx >= self.circuit_breaker_threshold:
            if self._last_5xx_ts:
                last = datetime.fromisoformat(self._last_5xx_ts)
                elapsed = (datetime.now(timezone.utc) - last).total_seconds()
                if elapsed < self.circuit_breaker_cooldown_sec:
                    return False, f"Circuit breaker open: {self.consecutive_5xx} consecutive 5xx, cooldown {self.circuit_breaker_cooldown_sec - elapsed:.0f}s remaining"
                else:
                    self.consecutive_5xx = 0  # reset after cooldown
        return True, "ok"

    def record_request(self, status_code: int | None = None) -> None:
        """Record a request. If status is 5xx, increment circuit breaker."""
        self.request_count += 1
        if status_code and 500 <= status_code < 600:
            self.consecutive_5xx += 1
            self._last_5xx_ts = datetime.now(timezone.utc).isoformat()
        elif status_code and status_code < 500:
            self.consecutive_5xx = 0  # reset on success or 4xx

    @property
    def exhausted(self) -> bool:
        return self.request_count >= self.max_requests

    @property
    def breaker_open(self) -> bool:
        return self.consecutive_5xx >= self.circuit_breaker_threshold