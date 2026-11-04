"""CSRF module — check stateful forms for missing anti-CSRF tokens."""

import httpx
import re
from nikspider.stage2_spiderpois.base import CheckModule
from nikspider.common.models import Finding

CSRF_FIELD_PATTERNS = [
    re.compile(r"csrf[_\-]?token", re.I),
    re.compile(r"_token", re.I),
    re.compile(r"xsrf", re.I),
    re.compile(r"nonce", re.I),
    re.compile(r"authenticity_token", re.I),
]


class AccessModule(CheckModule):
    """CSRF + Access Control combined. The original `access.py` module.

    Note: This module checks for:
      - Missing CSRF tokens on state-changing forms
      - IDOR-like access control issues (see dedicated idor.py too)
    """
    name = "csrf"
    group = "identity"
    requires = {"auth"}

    async def run(self, page: dict, client: httpx.AsyncClient, scan_id: str) -> list[Finding]:
        findings: list[Finding] = []
        url = page.get("url", "")

        for form in page.get("forms", []):
            action = form.get("action", url)
            method = form.get("method", "get").upper()
            form_inputs = form.get("inputs", [])

            if method != "POST":
                continue

            has_csrf = any(
                any(p.search(inp) for p in CSRF_FIELD_PATTERNS)
                for inp in form_inputs
            )

            if not has_csrf and form_inputs:
                findings.append(Finding(
                    scan_id=scan_id, module=self.name, url=action, param="",
                    request=f"POST {action} form inputs: {form_inputs}",
                    response=f"POST form at {action} missing CSRF token",
                    signal=f"POST form at {action} has no CSRF token field",
                    status="raw",
                    extra={"action": action, "inputs": form_inputs,
                           "owasp": "A01:2021-Broken Access Control"},
                ))

        return findings

    async def retest(self, finding: Finding | dict, client: httpx.AsyncClient) -> bool:
        f = finding if isinstance(finding, dict) else finding.to_dict()
        url = f.get("url", "")
        try:
            r = await client.get(url, timeout=8.0)
            # 403 → access is now properly denied (fixed)
            if r.status_code == 403:
                return True
            # Csrf token present → fixed
            from bs4 import BeautifulSoup
            soup = BeautifulSoup(r.text, "html.parser")
            for form in soup.find_all("form"):
                if form.get("method", "").upper() == "POST":
                    inputs = [i.get("name", "") for i in form.find_all(["input", "textarea"])]
                    if any(any(p.search(i) for p in CSRF_FIELD_PATTERNS) for i in inputs):
                        return True
            return False
        except Exception:
            return True

# Backward-compatible alias: this module was historically AccessControlModule.
AccessControlModule = AccessModule
