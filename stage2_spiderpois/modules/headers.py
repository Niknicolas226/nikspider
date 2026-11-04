"""HTTP Security Headers module — CSP, HSTS, X-Frame-Options, X-Content-Type-Options.

Single-pass check: no payload needed, just inspect response headers.
"""

import httpx
from urllib.parse import urlparse
from nikspider.stage2_spiderpois.base import CheckModule
from nikspider.common.models import Finding

SECURITY_HEADERS = {
    "content-security-policy": "Missing Content-Security-Policy header",
    "strict-transport-security": "Missing Strict-Transport-Security header",
    "x-frame-options": "Missing X-Frame-Options header",
    "x-content-type-options": "Missing X-Content-Type-Options header",
}


class HeadersModule(CheckModule):
    name = "headers"
    group = "client"

    async def run(self, page: dict, client: httpx.AsyncClient, scan_id: str) -> list[Finding]:
        findings: list[Finding] = []
        url = page.get("url", "")
        parsed = urlparse(url)

        try:
            r = await client.get(url, timeout=8.0)
        except Exception:
            return findings

        resp_headers_lower = {k.lower() for k in r.headers}

        for header, msg in SECURITY_HEADERS.items():
            if header not in resp_headers_lower:
                if header == "strict-transport-security" and parsed.scheme != "https":
                    continue
                findings.append(Finding(
                    scan_id=scan_id, module=self.name, url=url, param="",
                    request=f"GET {url}", response=str(dict(r.headers))[:2000],
                    signal=msg,
                    status="raw",
                    extra={"missing_header": header, "owasp": "A05:2021-Security Misconfiguration"},
                ))

        return findings

    async def retest(self, finding: Finding | dict, client: httpx.AsyncClient) -> bool:
        f = finding if isinstance(finding, dict) else finding.to_dict()
        url = f.get("url", "")
        extra = f.get("extra", {})
        missing_header = extra.get("missing_header", "")
        try:
            r = await client.get(url, timeout=8.0)
            return missing_header.lower() in {k.lower() for k in r.headers}
        except Exception:
            return True