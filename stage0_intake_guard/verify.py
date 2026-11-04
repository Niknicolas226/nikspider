"""Ownership verification: token file at /.well-known/nikspider.txt or DNS TXT record."""

import secrets
import httpx
from urllib.parse import urlparse


def new_token() -> str:
    """Generate a secure, random ownership verification token."""
    return f"nikspider-verify={secrets.token_urlsafe(16)}"


async def verify_file(base_url: str, token: str, client: httpx.AsyncClient | None = None) -> bool:
    """Verify ownership via /.well-known/nikspider.txt file."""
    parsed = urlparse(base_url)
    clean_base = f"{parsed.scheme}://{parsed.netloc}"
    target = f"{clean_base}/.well-known/nikspider.txt"
    try:
        if client:
            r = await client.get(target, timeout=10)
            return r.status_code == 200 and token in r.text
        else:
            async with httpx.AsyncClient(timeout=10, follow_redirects=True) as c:
                r = await c.get(target)
                return r.status_code == 200 and token in r.text
    except Exception:
        return False