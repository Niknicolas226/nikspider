"""IP guard: SSRF/private IP blocking, DNS rebinding protection, rate limiting."""

from nikspider.common.http_client import (
    is_allowed_target,
    is_ip_blocked,
    normalize_ip,
    is_public_host,
    GuardedClient,
    DEMO_HOSTS,
    BLOCKED_NETWORKS,
)

__all__ = [
    "is_allowed_target",
    "is_ip_blocked",
    "normalize_ip",
    "is_public_host",
    "GuardedClient",
    "DEMO_HOSTS",
    "BLOCKED_NETWORKS",
]