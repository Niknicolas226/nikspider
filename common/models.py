"""Shared data models and dataclasses used across all stages."""

import uuid
from dataclasses import dataclass, field, asdict
from typing import Any, Optional


@dataclass
class Finding:
    """Core finding dataclass — the universal currency of NikSpider."""
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    scan_id: str = ""
    module: str = ""
    url: str = ""
    param: str = ""
    request: str = ""
    response: str = ""          # Truncated to 2000 chars
    signal: str = ""
    status: str = "raw"
    extra: dict[str, Any] = field(default_factory=dict)

    # Extended fields (v2)
    group: str = ""              # injection|client|identity|platform
    confidence: str = "medium"   # low|medium|high
    evidence_refs: list[str] = field(default_factory=list)
    repro: dict[str, Any] = field(default_factory=dict)
    surface_id: str = ""
    role: str = "anon"
    dedup_key: str = ""

    def to_dict(self) -> dict:
        d = asdict(self)
        if len(d["response"]) > 2000:
            d["response"] = d["response"][:2000]
        return d


@dataclass
class SurfaceTarget:
    """A single endpoint+param combination in the attack surface graph."""
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    url: str = ""
    method: str = "GET"
    params: list["Param"] = field(default_factory=list)
    auth_required: Optional[bool] = None
    roles_tested: set[str] = field(default_factory=set)
    forms: list[dict] = field(default_factory=list)
    api: Optional["ApiMeta"] = None
    cacheable: Optional[bool] = None
    upload: bool = False
    mutating: bool = False


@dataclass
class Param:
    """A single parameter on an endpoint with sink classification."""
    name: str = ""
    location: str = ""           # query|body|path|header|cookie
    sink: str = ""               # sql|html|html_attr|js|url|path|file|header|json|template|unknown
    reflection: str = ""         # none|immediate|stored|deferred
    tainted_by: str = ""         # query|form|cookie|header|path


@dataclass
class ApiMeta:
    kind: str = ""               # rest|graphql|unknown
    schema_path: str = ""
    introspection_enabled: bool = False


@dataclass
class Signal:
    """Output of a single probe — consumed by confirm() and the judge."""
    module: str = ""
    surface_id: str = ""
    oracle_family: str = ""      # inband|oast|browser|timing
    strength: str = "medium"     # strong|medium|weak
    evidence: dict[str, Any] = field(default_factory=dict)
    independent: bool = True     # whether this signal is independent of others


@dataclass
class ScanContext:
    """Mutable context carried through a single scan pipeline."""
    scan_id: str = ""
    target_url: str = ""
    profile: str = "standard"
    max_requests: int = 500
    request_count: int = 0
    roles: dict[str, "SessionCtx"] = field(default_factory=dict)
    allow_writes: bool = False


@dataclass
class SessionCtx:
    """A single authenticated session for role-based testing."""
    role: str = ""               # anon|userA|userB|admin
    cookies: dict[str, str] = field(default_factory=dict)
    headers: dict[str, str] = field(default_factory=dict)
    owned_ids: list[str] = field(default_factory=list)


@dataclass
class TestAccount:
    """Pre-authorized test account supplied by the operator."""
    name: str = ""
    cookies: dict[str, str] = field(default_factory=dict)
    owned_ids: list[str] = field(default_factory=list)