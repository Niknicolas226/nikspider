"""Open redirect module — redirect param reflection check."""

from urllib.parse import urlparse, parse_qs, urlencode, urlunparse
import httpx
from nikspider.stage2_spiderpois.base import CheckModule
from nikspider.common.models import Finding

REDIRECT_PARAMS = [
    "redirect", "url", "next", "return", "return_to", "return_url",
    "redirect_uri", "continue", "goto", "target", "destination",
    "redir", "origin", "referer", "back",
]

EXTERNAL_CANARY = "https://evil-canary.invalid/"


def _is_redirect_param(name: str) -> bool:
    name_lower = name.lower()
    return any(kw == name_lower or kw in name_lower for kw in REDIRECT_PARAMS)


class OpenRedirectModule(CheckModule):
    name = "open_redirect"
    group = "client"

    async def run(self, page: dict, client: httpx.AsyncClient, scan_id: str) -> list[Finding]:
        findings: list[Finding] = []
        url = page.get("url", "")
        parsed = urlparse(url)
        params = parse_qs(parsed.query)
        if not params and page.get("query_params"):
            params = {k: ["test"] for k in page["query_params"]}

        for param in params.keys():
            if not _is_redirect_param(param):
                continue
            q = dict(params)
            q[param] = [EXTERNAL_CANARY]
            probe_url = urlunparse(parsed._replace(query=urlencode(q, doseq=True)))
            try:
                r = await client.get(probe_url, timeout=8.0, follow_redirects=False)
                location = r.headers.get("location", "")
                if EXTERNAL_CANARY in location:
                    findings.append(Finding(
                        scan_id=scan_id, module=self.name, url=url, param=param,
                        request=f"GET {probe_url}",
                        response=str(dict(r.headers))[:2000],
                        signal=f"Open redirect: Location header reflects external URL canary",
                        status="raw",
                        extra={"param": param, "redirect_status": r.status_code},
                    ))
            except Exception:
                pass

        # Also check POST forms
        for form in page.get("forms", []):
            action = form.get("action", url)
            method = form.get("method", "get").upper()
            form_inputs = form.get("inputs", [])
            if method == "POST":
                for inp in form_inputs:
                    if not _is_redirect_param(inp):
                        continue
                    data = {i: "test" for i in form_inputs}
                    data[inp] = EXTERNAL_CANARY
                    try:
                        r = await client.post(action, data=data, timeout=8.0, follow_redirects=False)
                        location = r.headers.get("location", "")
                        if EXTERNAL_CANARY in location:
                            findings.append(Finding(
                                scan_id=scan_id, module=self.name, url=action, param=inp,
                                request=f"POST {action} data[inp]={EXTERNAL_CANARY}",
                                response=str(dict(r.headers))[:2000],
                                signal=f"Open redirect: Location header reflects external URL canary",
                                status="raw",
                                extra={"param": inp, "redirect_status": r.status_code},
                            ))
                    except Exception:
                        pass
        return findings

    async def retest(self, finding: Finding | dict, client: httpx.AsyncClient) -> bool:
        f = finding if isinstance(finding, dict) else finding.to_dict()
        url = f.get("url", "")
        param = f.get("param", "")
        parsed = urlparse(url)
        params = parse_qs(parsed.query)
        params[param] = [EXTERNAL_CANARY]
        probe_url = urlunparse(parsed._replace(query=urlencode(params, doseq=True)))
        try:
            r = await client.get(probe_url, timeout=8.0, follow_redirects=False)
            location = r.headers.get("location", "")
            return EXTERNAL_CANARY not in location
        except Exception:
            return True
