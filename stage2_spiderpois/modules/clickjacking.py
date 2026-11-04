"""Clickjacking module — X-Frame-Options / CSP frame-ancestors check."""

import httpx
from nikspider.stage2_spiderpois.base import CheckModule
from nikspider.common.models import Finding


class ClickjackingModule(CheckModule):
    name = "clickjacking"
    group = "client"

    async def run(self, page: dict, client: httpx.AsyncClient, scan_id: str) -> list[Finding]:
        findings: list[Finding] = []
        url = page.get("url", "")
        try:
            r = await client.get(url, timeout=8.0)
        except Exception:
            return findings
        xfo = r.headers.get("x-frame-options", "").lower()
        csp = r.headers.get("content-security-policy", "").lower()
        has_frame_ancestors = "frame-ancestors" in csp

        if not xfo and not has_frame_ancestors:
            findings.append(Finding(
                scan_id=scan_id, module=self.name, url=url, param="",
                request=f"GET {url}",
                response=str(dict(r.headers))[:2000],
                signal="Page has no X-Frame-Options or CSP frame-ancestors directive",
                status="raw",
                extra={"missing": "clickjack-protection"},
            ))
        return findings

    async def retest(self, finding: Finding | dict, client: httpx.AsyncClient) -> bool:
        f = finding if isinstance(finding, dict) else finding.to_dict()
        url = f.get("url", "")
        try:
            r = await client.get(url, timeout=8.0)
            xfo = (r.headers.get("x-frame-options") or "").lower()
            csp = (r.headers.get("content-security-policy") or "").lower()
            return bool(xfo) or ("frame-ancestors" in csp)
        except Exception:
            return True
