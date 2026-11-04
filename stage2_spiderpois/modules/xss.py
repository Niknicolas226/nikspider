"""Reflected & DOM XSS module — canary marker reflection + SPA DOM check."""

from urllib.parse import urlparse, parse_qs, urlencode, urlunparse
import httpx
from nikspider.stage2_spiderpois.base import CheckModule
from nikspider.common.models import Finding

XSS_MARKER_TAG = '<nspmarker id="z">'


class XSSModule(CheckModule):
    name = "xss"
    group = "client"

    async def _test_get_param(self, url: str, param: str, client: httpx.AsyncClient,
                              scan_id: str) -> Finding | None:
        parsed = urlparse(url)
        params = parse_qs(parsed.query)
        params[param] = [f'nsp"{XSS_MARKER_TAG}']
        probe_url = urlunparse(parsed._replace(query=urlencode(params, doseq=True)))
        try:
            r = await client.get(probe_url, timeout=8.0)
            content_type = r.headers.get("content-type", "").lower()
            if "html" not in content_type and "<html" not in r.text.lower():
                return None
            if XSS_MARKER_TAG in r.text:
                return Finding(
                    scan_id=scan_id, module=self.name, url=url, param=param,
                    request=f"GET {probe_url}", response=r.text[:2000],
                    signal=f"Unescaped HTML marker tag reflected: '{XSS_MARKER_TAG}'",
                    status="raw", extra={"type": "reflected", "method": "GET"})
        except Exception:
            pass
        return None

    async def _test_post_form(self, action: str, param: str, all_inputs: list[str],
                              client: httpx.AsyncClient, scan_id: str) -> Finding | None:
        data = {i: "test" for i in all_inputs}
        data[param] = f'nsp"{XSS_MARKER_TAG}'
        try:
            r = await client.post(action, data=data, timeout=8.0)
            content_type = r.headers.get("content-type", "").lower()
            if "html" not in content_type and "<html" not in r.text.lower():
                return None
            if XSS_MARKER_TAG in r.text:
                return Finding(
                    scan_id=scan_id, module=self.name, url=action, param=param,
                    request=f"POST {action} data={data}", response=r.text[:2000],
                    signal=f"Unescaped HTML marker tag reflected: '{XSS_MARKER_TAG}'",
                    status="raw", extra={"type": "reflected", "method": "POST"})
        except Exception:
            pass
        return None

    async def _test_spa_dom_xss(self, url: str, input_name: str, scan_id: str) -> Finding | None:
        try:
            from playwright.async_api import async_playwright
            async with async_playwright() as p:
                browser = await p.chromium.launch(headless=True)
                page = await browser.new_page()
                await page.goto(url, wait_until="networkidle", timeout=10000)
                selector = f"input[name='{input_name}']"
                if not await page.query_selector(selector):
                    selector = f"input[placeholder*='{input_name}' i], input[id='{input_name}']"
                if await page.query_selector(selector):
                    await page.fill(selector, XSS_MARKER_TAG)
                    await page.press(selector, "Enter")
                    await page.wait_for_timeout(1000)
                    marker_exists = await page.evaluate(
                        "() => !!document.getElementById('z') || document.body.innerHTML.includes('<nspmarker')")
                    content = await page.content()
                    await browser.close()
                    if marker_exists:
                        return Finding(
                            scan_id=scan_id, module=self.name, url=url, param=input_name,
                            request=f"DOM input '{input_name}' value='{XSS_MARKER_TAG}'",
                            response=content[:2000],
                            signal=f"DOM XSS harmless marker rendered into DOM: '{XSS_MARKER_TAG}'",
                            status="raw", extra={"type": "dom_xss", "method": "PLAYWRIGHT"})
                await browser.close()
        except Exception:
            pass
        return None

    async def run(self, page: dict, client: httpx.AsyncClient, scan_id: str) -> list[Finding]:
        findings: list[Finding] = []
        url = page.get("url", "")
        parsed = urlparse(url)

        params = parse_qs(parsed.query)
        if not params and page.get("query_params"):
            params = {k: ["test"] for k in page["query_params"]}

        for param in params.keys():
            finding = await self._test_get_param(url, param, client, scan_id)
            if finding:
                findings.append(finding)

        for form in page.get("forms", []):
            action = form.get("action", url)
            method = form.get("method", "get").upper()
            form_inputs = form.get("inputs", [])
            if method == "POST":
                for inp in form_inputs:
                    finding = await self._test_post_form(action, inp, form_inputs, client, scan_id)
                    if finding:
                        findings.append(finding)
            elif method == "GET":
                for inp in form_inputs:
                    finding = await self._test_get_param(action, inp, client, scan_id)
                    if finding:
                        findings.append(finding)

        if "#/" in url or "search" in url.lower():
            for form in page.get("forms", []):
                for inp in form.get("inputs", []):
                    if any(s in inp.lower() for s in ["q", "query", "search", "keyword"]):
                        dom_finding = await self._test_spa_dom_xss(url, inp, scan_id)
                        if dom_finding:
                            findings.append(dom_finding)
        return findings

    async def retest(self, finding: Finding | dict, client: httpx.AsyncClient) -> bool:
        f = finding if isinstance(finding, dict) else finding.to_dict()
        url = f.get("url", "")
        param = f.get("param", "")
        extra = f.get("extra", {})
        method = extra.get("method", "GET")
        if method == "GET":
            parsed = urlparse(url)
            params = parse_qs(parsed.query)
            params[param] = [f'nsp"{XSS_MARKER_TAG}']
            probe_url = urlunparse(parsed._replace(query=urlencode(params, doseq=True)))
            try:
                r = await client.get(probe_url, timeout=8.0)
                return XSS_MARKER_TAG not in r.text
            except Exception:
                return True
        elif method == "POST":
            try:
                r = await client.post(url, data={param: f'nsp"{XSS_MARKER_TAG}'}, timeout=8.0)
                return XSS_MARKER_TAG not in r.text
            except Exception:
                return True
        return True