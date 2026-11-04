"""Security Headers (Content-Security-Policy, HSTS, Referrer-Policy) — broader check."""

import httpx
from nikspider.stage2_spiderpois.base import CheckModule
from nikspider.common.models import Finding

EXTRA_HEADERS = {
    "content-security-policy": {
        "msg": "Missing Content-Security-Policy header",
        "level": "High",
    },
    "referrer-policy": {
        "msg": "Missing Referrer-Policy header",
        "level": "Low",
    },
    "permissions-policy": {
        "msg": "Missing Permissions-Policy header",
        "level": "Low",
    },
}


class SecurityHeadersModule(CheckModule):
    name = "security_headers"
    group = "platform"

    async def run(self, page: dict, client: httpx.AsyncClient, scan_id: str) -> list[Finding]:
        findings: list[Finding] = []
        url = page.get("url", "")
        try:
            r = await client.get(url, timeout=8.0)
        except Exception:
            return findings
        hlower = {k.lower() for k in r.headers}
        for header, info in EXTRA_HEADERS.items():
            if header not in hlower:
                findings.append(Finding(
                    scan_id=scan_id, module=self.name, url=url, param="",
                    request=f"GET {url}",
                    response=str(dict(r.headers))[:2000],
                    signal=info["msg"],
                    status="raw",
                    extra={"missing_header": header},
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
