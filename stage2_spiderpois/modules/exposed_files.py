"""Exposed sensitive files/dirs — .git, .env, .DS_Store, etc."""

import asyncio
import httpx
from urllib.parse import urljoin, urlparse
from nikspider.stage2_spiderpois.base import CheckModule
from nikspider.common.models import Finding

SENSITIVE_PATHS = [
    "/.env",
    "/.git/HEAD",
    "/.DS_Store",
    "/.svn/entries",
    "/backup.zip",
    "/backup.tar.gz",
    "/wp-config.php.bak",
    "/robots.txt",
    "/admin/",
    "/phpinfo.php",
    "/info.php",
    "/server-status",
    "/debug",
    "/actuator/health",
    "/actuator/info",
    "/swagger-ui.html",
    "/api-docs",
    "/v2/api-docs",
    "/graphql",
    "/.well-known/security.txt",
]


class ExposedFilesModule(CheckModule):
    name = "exposed_files"
    group = "platform"

    async def run(self, page: dict, client: httpx.AsyncClient, scan_id: str) -> list[Finding]:
        findings: list[Finding] = []
        url = page.get("url", "")
        parsed = urlparse(url)
        base = f"{parsed.scheme}://{parsed.netloc}"
        depth = page.get("depth", 0)
        if depth is not None and int(depth) > 1:
            return findings  # Only check on top-level pages

        for path in SENSITIVE_PATHS:
            target = urljoin(base, path)
            try:
                r = await client.get(target, timeout=8.0)
                if r.status_code == 200:
                    content_preview = r.text[:500]
                    findings.append(Finding(
                        scan_id=scan_id, module=self.name, url=target, param="",
                        request=f"GET {target}",
                        response=content_preview,
                        signal=f"Exposed path accessible: {path} (status {r.status_code})",
                        status="raw",
                        extra={"path": path, "status": r.status_code},
                    ))
                await asyncio.sleep(0.05)
            except Exception:
                pass
        return findings

    async def retest(self, finding: Finding | dict, client: httpx.AsyncClient) -> bool:
        f = finding if isinstance(finding, dict) else finding.to_dict()
        url = f.get("url", "")
        try:
            r = await client.get(url, timeout=8.0)
            return r.status_code != 200  # Fixed if no longer accessible
        except Exception:
            return True
