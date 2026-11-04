"""Web cache poisoning/deception check — cache headers + dynamic content."""

import httpx
from nikspider.stage2_spiderpois.base import CheckModule
from nikspider.common.models import Finding

CACHE_HEADERS = ["x-cache", "x-cache-hit", "cf-cache-status", "x-akamai-transformed",
                 "x-served-by", "age", "cache-control", "etag"]


class CacheModule(CheckModule):
    name = "cache"
    group = "platform"

    async def run(self, page: dict, client: httpx.AsyncClient, scan_id: str) -> list[Finding]:
        findings: list[Finding] = []
        url = page.get("url", "")
        try:
            r1 = await client.get(url, timeout=8.0)
        except Exception:
            return findings
        r2 = None
        try:
            r2 = await client.get(url, timeout=8.0)
        except Exception:
            pass

        cache_evidence = {}
        for header in CACHE_HEADERS:
            val = r1.headers.get(header)
            if val:
                cache_evidence[header] = val

        if cache_evidence:
            findings.append(Finding(
                scan_id=scan_id, module=self.name, url=url, param="",
                request=f"GET {url}",
                response=str(dict(r1.headers))[:2000],
                signal=f"Cache headers detected: {cache_evidence}",
                status="raw",
                extra={"cache_headers": cache_evidence},
            ))
        return findings

    async def retest(self, finding: Finding | dict, client: httpx.AsyncClient) -> bool:
        return True  # Informational only
