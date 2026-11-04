"""Shared HTTP client with guard enforcement and request logging."""

import ipaddress
import os
import socket
from datetime import datetime, timezone
from urllib.parse import urlparse
import httpx
from dotenv import load_dotenv

load_dotenv()

try:
    from nikspider.common.db import log_request
except ImportError:
    from backend.db import log_request  # fallback

DEMO_HOSTS = {"localhost", "127.0.0.1", "::1", "demo-app", "juice-shop"}

BLOCKED_NETWORKS = [
    ipaddress.ip_network("127.0.0.0/8"),
    ipaddress.ip_network("10.0.0.0/8"),
    ipaddress.ip_network("172.16.0.0/12"),
    ipaddress.ip_network("192.168.0.0/16"),
    ipaddress.ip_network("169.254.0.0/16"),
    ipaddress.ip_network("::1/128"),
    ipaddress.ip_network("fc00::/7"),
    ipaddress.ip_network("fe80::/10"),
]


def normalize_ip(raw: str) -> str:
    """Normalize decimal, octal, hex, and integer IP representations to standard dotted-quad."""
    raw = raw.strip()
    # Integer form: http://2130706433
    try:
        if raw.isdigit() and 0 <= int(raw) <= 0xFFFFFFFF:
            addr = int(raw)
            return str(ipaddress.IPv4Address(addr))
    except (ValueError, ipaddress.AddressValueError):
        pass
    # Try standard parsing which handles octal and hex
    try:
        return str(ipaddress.ip_address(raw))
    except ValueError:
        return raw


def is_ip_blocked(ip_str: str) -> bool:
    """Check if an IP address (normalized) falls in any blocked range."""
    try:
        ip = ipaddress.ip_address(normalize_ip(ip_str))
        # IPv4-mapped IPv6 (::ffff:x.x.x.x)
        if isinstance(ip, ipaddress.IPv6Address) and ip.ipv4_mapped:
            ip = ip.ipv4_mapped
        for net in BLOCKED_NETWORKS:
            if ip in net:
                return True
        return False
    except ValueError:
        return False


def is_public_host(url: str, demo_allow: tuple[str, ...] | set[str] = ()) -> bool:
    """Validate a URL resolves only to public, non-blocked IPs."""
    try:
        parsed = urlparse(url)
        host = parsed.hostname
        if not host:
            return False
        if host in demo_allow:
            return True
        # Require ALL resolved addresses to be public
        for info in socket.getaddrinfo(host, None):
            ip_str = info[4][0]
            if is_ip_blocked(ip_str):
                return False
        return True
    except (socket.gaierror, ValueError):
        return False


def is_allowed_target(url: str) -> bool:
    """Check if target is allowed (respects DEMO_MODE)."""
    demo_mode = os.getenv("DEMO_MODE", "0").lower() in ("1", "true", "yes")
    demo_allow = DEMO_HOSTS if demo_mode else ()
    return is_public_host(url, demo_allow=demo_allow)


class GuardedClient(httpx.AsyncClient):
    """HTTP client that enforces IP guard on every request and logs to DB."""

    def __init__(self, scan_id: str | None = None, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.scan_id = scan_id

    async def send(self, request: httpx.Request, *args, **kwargs):
        url_str = str(request.url)
        if not is_allowed_target(url_str):
            raise PermissionError(f"Target URL '{url_str}' is blocked by security guard (private/restricted IP).")
        status_code = None
        ts = datetime.now(timezone.utc).isoformat()
        try:
            response = await super().send(request, *args, **kwargs)
            status_code = response.status_code
            return response
        except Exception:
            raise
        finally:
            log_request(self.scan_id, ts, request.method, url_str, status_code)
