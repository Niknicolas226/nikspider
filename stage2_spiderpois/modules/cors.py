"""CORS misconfiguration module — reflected Origin with credentials check."""

import httpx
from nikspider.stage2_spiderpois.base import CheckModule
from nikspider.common.models import Finding

SAFE_CANARY_HOST = "evil-canary.invalid"


class CORSModule(CheckModule):
    name = "cors"
    group = "client"

    async def run(self, page: dict, client: httpx.AsyncClient, scan_id: str) -> list[Finding]:
        findings: list[Finding] = []
        url = page.get("url", "")
        origin = f"https://{SAFE_CANARY_HOST}"

        try:
            r = await client.get(url, headers={"Origin": origin}, timeout=8.0)
        except Exception:
            return findings

        acao = r.headers.get("access-control-allow-origin", "")
        acac = r.headers.get("access-control-allow-credentials", "").lower()

        if acao == origin or acao == "*":
            severity = "High" if acao == origin and acac == "true" else "Low"
            findings.append(Finding(
                scan_id=scan_id, module=self.name, url=url, param="",
                request=f"GET {url} Origin: {origin}",
                response=str(dict(r.headers))[:2000],
                signal=f"CORS allows origin '{acao}' (credentials={acac or 'false'})",
                status="raw",
                extra={"origin": origin, "acao": acao, "acac": acac,
                       "owasp": "A05:2021-Security Misconfiguration"},
            ))

        return findings

    async def retest(self, finding: Finding | dict, client: httpx.AsyncClient) -> bool:
        f = finding if isinstance(finding, dict) else finding.to_dict()
        url = f.get("url", "")
        origin = f"https://{SAFE_CANARY_HOST}"
        try:
            r = await client.get(url, headers={"Origin": origin}, timeout=8.0)
            acao = r.headers.get("access-control-allow-origin", "")
            # Fixed if origin is NOT reflected back
            return acao != origin and acao != "*"
        except Exception:
            return True