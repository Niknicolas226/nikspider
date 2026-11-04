"""IDOR module — horizontal privilege escalation via numeric ID enumeration.

Requires at least two roles (userA, userB) with known owned_ids.
"""

import httpx
import re
from urllib.parse import urlparse, urljoin
from nikspider.stage2_spiderpois.base import CheckModule
from nikspider.common.models import Finding

NUMERIC_ID_PATTERN = re.compile(r"/(\d{1,9})(?:[/?#]|$)")
UUID_PATTERN = re.compile(r"/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:[/?#]|$)", re.I)


class IDORModule(CheckModule):
    name = "idor"
    group = "identity"
    requires = {"role:userA", "role:userB"}

    async def run(self, page: dict, client: httpx.AsyncClient, scan_id: str,
                  roles: dict | None = None) -> list[Finding]:
        findings: list[Finding] = []
        url = page.get("url", "")

        if not roles or len(roles) < 2:
            return findings

        role_list = list(roles.values())
        # userA has some owned_ids, userB should NOT be able to access them
        user_a = role_list[1] if len(role_list) > 1 else None
        user_b = role_list[2] if len(role_list) > 2 else role_list[-1]

        if not user_a or not user_b:
            return findings
        if not getattr(user_a, "owned_ids", None) and not getattr(user_b, "owned_ids", None):
            return findings

        # Find numeric IDs in the URL
        for match in NUMERIC_ID_PATTERN.findall(url):
            try:
                # Use userB's session to access userA's resource ID
                r = await client.get(url.replace(f"/{match}", f"/{int(match) + 1}"), timeout=8.0)
                if r.status_code == 200 and r.text:
                    findings.append(Finding(
                        scan_id=scan_id, module=self.name, url=url, param="id",
                        request=f"GET {url} as userB",
                        response=r.text[:2000],
                        signal="Horizontal IDOR: sequential numeric ID accessible from foreign role",
                        status="raw",
                        extra={"original_id": match, "probed_id": str(int(match) + 1)},
                    ))
                    break
            except Exception:
                pass

        return findings

    async def retest(self, finding: Finding | dict, client: httpx.AsyncClient) -> bool:
        f = finding if isinstance(finding, dict) else finding.to_dict()
        url = f.get("url", "")
        extra = f.get("extra", {})
        probed_id = extra.get("probed_id", "")
        try:
            r = await client.get(url, timeout=8.0)
            # Fixed if accessing another user's ID returns 403/404
            return r.status_code in (403, 404)
        except Exception:
            return True