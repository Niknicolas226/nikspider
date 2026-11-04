"""SQL & NoSQL Injection module — error-based + boolean differential."""

import html
import re
import urllib.parse
from urllib.parse import urlparse, parse_qs, urlencode, urlunparse
import httpx
from nikspider.stage2_spiderpois.base import CheckModule
from nikspider.common.models import Finding


def _variants(p: str) -> set[str]:
    return {p, html.escape(p), html.escape(p, quote=False),
            urllib.parse.quote(p), urllib.parse.quote_plus(p)}


def normalize(text: str, payloads: list[str]) -> str:
    for p in payloads:
        for v in sorted(_variants(p), key=len, reverse=True):
            text = text.replace(v, "")
    return " ".join(text.split())


def boolean_differential(base, true_r, false_r, p_true: str, p_false: str) -> bool:
    b = normalize(base.text if hasattr(base, "text") else str(base), [])
    t = normalize(true_r.text if hasattr(true_r, "text") else str(true_r), [p_true, p_false])
    f = normalize(false_r.text if hasattr(false_r, "text") else str(false_r), [p_true, p_false])
    return t == b and f != b


SQL_ERROR_PATTERNS = [
    re.compile(r"syntax error", re.I),
    re.compile(r"unrecognized token", re.I),
    re.compile(r"operationalerror", re.I),
    re.compile(r"you have an error in your sql syntax", re.I),
    re.compile(r"warning: mysql", re.I),
    re.compile(r"pg_query", re.I),
    re.compile(r"psycopg2", re.I),
    re.compile(r"ora-[0-9]{5}", re.I),
    re.compile(r"sqlite3", re.I),
    re.compile(r"odbc sql server driver", re.I),
    re.compile(r"unclosed quotation mark after the character string", re.I),
    re.compile(r"quoted string not properly terminated", re.I),
]


def find_sql_error(text: str) -> str | None:
    for pattern in SQL_ERROR_PATTERNS:
        match = pattern.search(text)
        if match:
            return match.group(0)
    return None


class SQLiModule(CheckModule):
    name = "sqli"
    group = "injection"
    max_requests = 50

    async def run(self, page: dict, client: httpx.AsyncClient, scan_id: str) -> list[Finding]:
        findings: list[Finding] = []
        url = page.get("url", "")
        parsed = urlparse(url)

        # 1. GET query parameters
        params = parse_qs(parsed.query)
        if not params and page.get("query_params"):
            params = {k: ["test"] for k in page["query_params"]}

        for param in params.keys():
            try:
                base_resp = await client.get(url, timeout=8.0)
            except Exception:
                continue

            if base_resp.status_code >= 500 or find_sql_error(base_resp.text):
                continue

            # Error-based probe
            q_probe = dict(params)
            q_probe[param] = ["test'"]
            probe_url = urlunparse(parsed._replace(query=urlencode(q_probe, doseq=True)))
            try:
                resp_quote = await client.get(probe_url, timeout=8.0)
            except Exception:
                continue

            error_signal = find_sql_error(resp_quote.text)
            if error_signal and not find_sql_error(base_resp.text):
                try:
                    re_check = await client.get(probe_url, timeout=8.0)
                    if find_sql_error(re_check.text):
                        findings.append(Finding(
                            scan_id=scan_id, module=self.name, url=url, param=param,
                            request=f"GET {probe_url}", response=resp_quote.text[:2000],
                            signal=f"SQL error pattern: '{error_signal}'",
                            status="raw", extra={"type": "error-based", "method": "GET"}))
                        continue
                except Exception:
                    pass

            # Boolean differential
            q_true = dict(params); q_true[param] = ["test' OR '1'='1"]
            q_false = dict(params); q_false[param] = ["test' OR '1'='2"]
            url_true = urlunparse(parsed._replace(query=urlencode(q_true, doseq=True)))
            url_false = urlunparse(parsed._replace(query=urlencode(q_false, doseq=True)))
            try:
                resp_true = await client.get(url_true, timeout=8.0)
                resp_false = await client.get(url_false, timeout=8.0)
                if resp_true.status_code == 200 and (resp_true.text != resp_false.text):
                    r2_true = await client.get(url_true, timeout=8.0)
                    r2_false = await client.get(url_false, timeout=8.0)
                    if (r2_true.text == resp_true.text) and (r2_false.text == resp_false.text):
                        findings.append(Finding(
                            scan_id=scan_id, module=self.name, url=url, param=param,
                            request=f"GET {url_true} vs {url_false}",
                            response=resp_true.text[:2000],
                            signal="Consistent boolean differential response",
                            status="raw", extra={"type": "boolean-differential", "method": "GET"}))
            except Exception:
                pass

        # 2. POST forms
        for form in page.get("forms", []):
            action = form.get("action", url)
            method = form.get("method", "get").upper()
            form_inputs = form.get("inputs", [])
            if method == "POST" and form_inputs:
                for inp in form_inputs:
                    base_data = {i: "test" for i in form_inputs}
                    try:
                        b_resp = await client.post(action, json=base_data, timeout=8.0)
                    except Exception:
                        continue
                    if b_resp.status_code >= 500 or find_sql_error(b_resp.text):
                        continue
                    quote_data = dict(base_data); quote_data[inp] = "test'"
                    try:
                        q_resp = await client.post(action, json=quote_data, timeout=8.0)
                        err_sig = find_sql_error(q_resp.text)
                        if err_sig and not find_sql_error(b_resp.text):
                            q_resp2 = await client.post(action, json=quote_data, timeout=8.0)
                            if find_sql_error(q_resp2.text):
                                findings.append(Finding(
                                    scan_id=scan_id, module=self.name, url=action, param=inp,
                                    request=f"POST {action} JSON {quote_data}",
                                    response=q_resp.text[:2000],
                                    signal=f"SQL error pattern: '{err_sig}'",
                                    status="raw", extra={"type": "error-based", "method": "POST"}))
                    except Exception:
                        pass
        return findings

    async def retest(self, finding: Finding | dict, client: httpx.AsyncClient) -> bool:
        f = finding if isinstance(finding, dict) else finding.to_dict()
        url = f.get("url", "")
        param = f.get("param", "")
        extra = f.get("extra", {})
        method = extra.get("method", "GET")
        finding_type = extra.get("type", "error-based")

        parsed = urlparse(url)
        if finding_type == "boolean-differential" and method == "GET":
            p_true = "test' OR '1'='1"
            p_false = "test' OR '1'='2"
            q_base = parse_qs(parsed.query)
            q_true = dict(q_base); q_true[param] = [p_true]
            q_false = dict(q_base); q_false[param] = [p_false]
            url_true = urlunparse(parsed._replace(query=urlencode(q_true, doseq=True)))
            url_false = urlunparse(parsed._replace(query=urlencode(q_false, doseq=True)))
            try:
                b_r = await client.get(url, timeout=8.0)
                t_r = await client.get(url_true, timeout=8.0)
                f_r = await client.get(url_false, timeout=8.0)
                return not boolean_differential(b_r, t_r, f_r, p_true, p_false)
            except Exception:
                return True

        if method == "GET":
            q_probe = parse_qs(parsed.query)
            q_probe[param] = ["test'"]
            probe_url = urlunparse(parsed._replace(query=urlencode(q_probe, doseq=True)))
            try:
                r = await client.get(probe_url, timeout=8.0)
                return find_sql_error(r.text) is None and r.status_code < 500
            except Exception:
                return True
        else:
            try:
                r = await client.post(url, json={param: "test'"}, timeout=8.0)
                return find_sql_error(r.text) is None and r.status_code < 500
            except Exception:
                return True