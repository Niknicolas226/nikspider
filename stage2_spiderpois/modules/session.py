"""Session management module — cookie attributes, session fixation, logout, token analysis."""

import re
from urllib.parse import urlparse, parse_qs
import httpx
from nikspider.stage2_spiderpois.base import CheckModule
from nikspider.common.models import Finding

SESSION_COOKIE_NAMES = {
    "session", "sessionid", "session_id", "sid", "connect.sid",
    "jwt", "token", "auth", "authtoken", "id_token", "access_token",
    "logged_in", "user_session", "jsessionid", "phpsessid",
}

SENSITIVE_URL_PARAMS = {
    "token", "access_token", "session", "session_id", "auth", "jwt", "api_key",
}


def is_session_cookie(cookie_name: str) -> bool:
    clean = cookie_name.strip().lower()
    return any(s in clean for s in SESSION_COOKIE_NAMES)


def parse_cookie_attributes(cookie_header: str) -> tuple[str, str, dict[str, str]]:
    parts = [p.strip() for p in cookie_header.split(";")]
    if not parts:
        return "", "", {}
    name_val = parts[0].split("=", 1)
    c_name = name_val[0].strip()
    c_val = name_val[1].strip() if len(name_val) > 1 else ""

    attrs = {}
    for part in parts[1:]:
        if "=" in part:
            k, v = part.split("=", 1)
            attrs[k.strip().lower()] = v.strip()
        else:
            attrs[part.strip().lower()] = "true"
    return c_name, c_val, attrs


def _get_set_cookie_headers(response) -> list[str]:
    """Extract all Set-Cookie headers from an httpx response."""
    headers = []
    if not response:
        return headers
    raw = response.headers.get("set-cookie")
    if raw:
        headers.append(raw)
    try:
        multi = response.headers.get_list("set-cookie")
        for m in multi:
            if m not in headers:
                headers.append(m)
    except Exception:
        pass
    try:
        multi2 = response.headers.multi_items()
        for k, v in multi2:
            if k.lower() == "set-cookie" and v not in headers:
                headers.append(v)
    except Exception:
        pass
    return headers


class SessionModule(CheckModule):
    name = "session"
    group = "identity"
    requires = {"auth"}

    async def run(self, page: dict, client: httpx.AsyncClient, scan_id: str) -> list[Finding]:
        findings: list[Finding] = []
        url = page.get("url", "")
        parsed = urlparse(url)

        # 1. Cookie attribute check using crawler data or fresh request
        cookie_headers = page.get("set_cookies", [])
        if not cookie_headers:
            try:
                r = await client.get(url, timeout=8.0)
                cookie_headers = _get_set_cookie_headers(r)
            except Exception:
                pass

        for header in cookie_headers:
            c_name, _, attrs = parse_cookie_attributes(header)
            if not is_session_cookie(c_name):
                continue  # Harmless / decoy cookie — skip

            missing = []
            if "httponly" not in attrs:
                missing.append("HttpOnly")
            if "secure" not in attrs:
                missing.append("Secure")
            if "samesite" not in attrs:
                missing.append("SameSite")

            if missing:
                sig = f"Session cookie '{c_name}' missing security flags: {', '.join(missing)}"
                findings.append(Finding(
                    scan_id=scan_id, module=self.name, url=url, param=c_name,
                    request=f"GET {url}",
                    response=f"Set-Cookie: {header}"[:2000],
                    signal=sig,
                    status="raw",
                    extra={
                        "cookie_name": c_name,
                        "missing": missing,
                        "header": header,
                        "owasp": "A05:2021-Security Misconfiguration",
                    },
                ))

        # 2. Sensitive authentication tokens in URL query parameters
        query_params = parse_qs(parsed.query)
        for param, vals in query_params.items():
            if param.lower() in SENSITIVE_URL_PARAMS and vals and len(vals[0]) > 6:
                findings.append(Finding(
                    scan_id=scan_id, module=self.name, url=url, param=param,
                    request=f"GET {url}",
                    response=f"URL containing sensitive credential: {url}"[:2000],
                    signal=f"Sensitive authentication token found in URL parameter '{param}'",
                    status="raw",
                    extra={"type": "token_in_url", "param": param},
                ))

        return findings

    async def retest(self, finding: Finding | dict, client: httpx.AsyncClient) -> bool:
        f = finding if isinstance(finding, dict) else finding.to_dict()
        url = f.get("url", "")
        param = f.get("param", "")
        extra = f.get("extra", {})

        if extra.get("type") == "token_in_url":
            parsed = urlparse(url)
            params = parse_qs(parsed.query)
            return param not in params

        try:
            r = await client.get(url, timeout=8.0)
            sc = r.headers.get("set-cookie", "")
            if not sc:
                return True  # Cookie no longer emitted

            c_name, _, attrs = parse_cookie_attributes(sc)
            if c_name.lower() == param.lower():
                has_httponly = "httponly" in attrs
                has_secure = "secure" in attrs
                return has_httponly and has_secure
            return True
        except Exception:
            return True