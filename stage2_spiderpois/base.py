"""Unified Probe interface — every module implements these three methods."""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any
import httpx

from nikspider.common.models import Finding, Signal, SurfaceTarget


@dataclass
class RawResponse:
    """Wrapper for raw HTTP response from a probe."""
    status_code: int = 0
    headers: dict[str, str] = field(default_factory=dict)
    text: str = ""
    elapsed: float = 0.0
    url: str = ""


class Probe(ABC):
    """Abstract Probe — the unified interface for all scan modules.

    Every module implements:
      - payload(target) -> list of payloads
      - send(payload, client) -> RawResponse
      - oracle(response) -> list of Signal
    """

    name: str = "base"
    group: str = ""              # injection|client|identity|platform
    requires: set[str] = set()   # {"auth"}, {"role:admin"}, {"browser"}
    destructive: bool = False
    max_requests: int = 20

    @abstractmethod
    async def run(self, page: dict, client: httpx.AsyncClient, scan_id: str) -> list[Finding]:
        """Run the module against a page. Returns raw findings."""
        ...

    @abstractmethod
    async def retest(self, finding: Finding | dict, client: httpx.AsyncClient) -> bool:
        """Retest a specific finding. Returns True if FIXED."""
        ...


class CheckModule(Probe):
    """Compatibility alias for the original CheckModule pattern."""
    pass


__all__ = ["Probe", "CheckModule", "RawResponse", "Finding", "Signal", "SurfaceTarget"]