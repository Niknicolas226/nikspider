"""SSRF module — server-side request forgery using OAST or in-band callback.

Requires OAST listener for primary detection.
"""

import secrets
import asyncio
from urllib.parse import urlparse, parse_qs, urlencode, urlunparse
import httpx
from nikspider.stage2_spiderpois.base import CheckModule
from nikspider.common.models import Finding
from nikspider.stage2_spiderpois.oracles.inband import oast_generate_canary, oast_check

SSRF_PARAM_NAMES = [
    "url", "uri", "redirect", "proxy", "callback", "webhook", "link",
    "image_url", "source", "src", "path", "dest", "destination",
    "redirect_uri", "return_url", "continue", "target", "next",
    "forward", "out", "site", "view", "file", "document", "fetch",
    "api_url", "endpoint", "host", "domain",
]


def _is_ssrf_param(name: str) -> bool:
    name_lower = name.lower()
    return any(kw in name_lower for kw in SSRF_PARAM_NAMES)


class SSRFModule(CheckModule):
    name = "ssrf"
    group = "injection"
    requires = {"oast"}

    def __init__(self, callback_host: str = "localhost:9337", *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.callback_host = callback_host

    async def run(self, page: dict, client: httpx.AsyncClient, scan_id: str) -> list[Finding]:
        findings: list[Finding] = []
        url = page.get("url", "")
        parsed = urlparse(url)

        # 1. GET query params that look like URL inputs
        params = parse_qs(parsed.query)
        if not params and page.get("query_params"):
            params = {k: ["placeholder"] for k in page["query_params"]}

        for param in params.keys():
            if not _is_ssrf_param(param):
                continue

            token = oast_generate_canary()
            canary_url = f"http://{self.callback_host}/{token}"

            q = dict(params)
            q[param] = [canary_url]
            probe_url = urlunparse(parsed._replace(query=urlencode(q, doseq=True)))
            try:
                await client.get(probe_url, timeout=8.0, follow_redirects=False)
            except Exception:
                continue

            await asyncio.sleep(2.0)
            if oast_check(token, timeout_sec=30.0):
                findings.append(Finding(
                    scan_id=scan_id, module=self.name, url=url, param=param,
                    request=f"GET {probe_url}",
                    response="OAST callback received",
                    signal=f"SSRF: server fetched OAST canary URL '{canary_url}'",
                    status="raw",
                    extra={"type": "oast", "canary": canary_url, "param": param},
                ))

        # 2. POST forms with URL-like params
        for form in page.get("forms", []):
            action = form.get("action", url)
            method = form.get("method", "get").upper()
            form_inputs = form.get("inputs", [])
            if method == "POST":
                for inp in form_inputs:
                    if not _is_ssrf_param(inp):
                        continue
                    token = oast_generate_canary()
                    canary_url = f"http://{self.callback_host}/{token}"
                    try:
                        data = {i: "placeholder" for i in form_inputs}
                        data[inp] = canary_url
                        await client.post(action, data=data, timeout=8.0, follow_redirects=False)
                        await asyncio.sleep(2.0)
                        if oast_check(token, timeout_sec=30.0):
                            findings.append(Finding(
                                scan_id=scan_id, module=self.name, url=action, param=inp,
                                request=f"POST {action} data[inp]={canary_url}",
                                response="OAST callback received",
                                signal=f"SSRF: server fetched OAST canary URL '{canary_url}'",
                                status="raw",
                                extra={"type": "oast", "canary": canary_url, "param": inp},
                            ))
                    except Exception:
                        continue

        return findings

    async def retest(self, finding: Finding | dict, client: httpx.AsyncClient) -> bool:
        f = finding if isinstance(finding, dict) else finding.to_dict()
        url = f.get("url", "")
        param = f.get("param", "")
        extra = f.get("extra", {})
        canary = extra.get("canary", "")

        if not canary:
            return True

        # Use a FRESH canary for retest: reusing the original token can still be
        # inside the hit window from the original scan and yield a false
        # "still vulnerable" verdict.
        token = oast_generate_canary()
        if "/" in canary:
            base = canary.rsplit("/", 1)[0]
            canary = f"{base}/{token}"
        else:
            canary = f"http://{self.callback_host}/{token}"

        parsed = urlparse(url)
        params = parse_qs(parsed.query)
        params[param] = [canary]
        probe_url = urlunparse(parsed._replace(query=urlencode(params, doseq=True)))
        try:
            await client.get(probe_url, timeout=8.0, follow_redirects=False)
            await asyncio.sleep(2.0)
            return not oast_check(token, timeout_sec=10.0)
        except Exception:
            return True