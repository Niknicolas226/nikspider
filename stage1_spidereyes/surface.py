"""Attack surface mapping: classify every (endpoint, param) into sink types.

For each discovered (endpoint, param), send a harmless canary and classify
where it lands in the response: HTML body, script tag, URL, header, error, etc.
This determines which Stage 2 modules are worth running.
"""

import re
import secrets
import uuid
from urllib.parse import urlparse, parse_qs, urlencode, urlunparse
from typing import Any
import httpx

from nikspider.common.models import SurfaceTarget, Param


CANARY_MARKER = f"nsp{secrets.token_hex(6)}"


def classify_sink(response_text: str, canary: str) -> str:
    """Classify where the canary appears in the response."""
    if canary not in response_text:
        return "none"

    # Check if inside <script> tags (JS context)
    script_match = re.search(rf"<script[^>]*>[^<]*{re.escape(canary)}", response_text, re.IGNORECASE)
    if script_match:
        return "js"

    # Check if inside an HTML attribute
    attr_match = re.search(rf'[a-zA-Z-]+\s*=\s*["\'][^"\']*{re.escape(canary)}', response_text, re.IGNORECASE)
    if attr_match:
        if "href" in attr_match.group().lower() or "src" in attr_match.group().lower():
            return "url"
        return "html_attr"

    # Check if appears in a URL context (redirect header, Location)
    if canary in response_text:
        lower = response_text.lower()
        # Check for common SQL error patterns nearby
        if any(e in lower for e in ["sql", "syntax error", "operationalerror", "mysql", "sqlite"]):
            return "sql"

    return "html"


async def probe_param(
    client: httpx.AsyncClient,
    url: str,
    param: str,
    method: str = "GET"
) -> tuple[str, str, str]:
    """Send a canary through one param and return (sink_class, reflection_type, raw_response)."""
    parsed = urlparse(url)
    params = parse_qs(parsed.query)
    params[param] = [CANARY_MARKER]

    if method == "GET":
        probe_url = urlunparse(parsed._replace(query=urlencode(params, doseq=True)))
        try:
            r = await client.get(probe_url, timeout=8.0)
            sink = classify_sink(r.text, CANARY_MARKER)
            reflection = "immediate" if sink != "none" else "none"
            return sink, reflection, r.text[:2000]
        except Exception:
            return "unknown", "none", ""
    else:
        try:
            r = await client.post(url, data={param: CANARY_MARKER}, timeout=8.0)
            sink = classify_sink(r.text, CANARY_MARKER)
            reflection = "immediate" if sink != "none" else "none"
            return sink, reflection, r.text[:2000]
        except Exception:
            return "unknown", "none", ""


async def build_surface_map(
    client: httpx.AsyncClient,
    crawl_map: list[dict],
    scan_id: str
) -> list[SurfaceTarget]:
    """Build attack surface graph from crawl map with sink classification."""
    targets: list[SurfaceTarget] = []

    for page in crawl_map:
        url = page.get("url", "")
        parsed = urlparse(url)

        # Query parameters
        params = parse_qs(parsed.query)
        for param_name in params:
            sink, reflection, _ = await probe_param(client, url, param_name)
            st = SurfaceTarget(
                id=str(uuid.uuid4()),
                url=url,
                method="GET",
                params=[Param(
                    name=param_name,
                    location="query",
                    sink=sink,
                    reflection=reflection,
                    tainted_by="query",
                )],
            )
            targets.append(st)

        # Form fields
        for form in page.get("forms", []):
            action = form.get("action", url)
            method = form.get("method", "get").upper()
            for input_name in form.get("inputs", []):
                sink, reflection, _ = await probe_param(client, action, input_name, method)
                st = SurfaceTarget(
                    id=str(uuid.uuid4()),
                    url=action,
                    method=method,
                    params=[Param(
                        name=input_name,
                        location="body" if method == "POST" else "query",
                        sink=sink,
                        reflection=reflection,
                        tainted_by="form",
                    )],
                    forms=[form],
                )
                targets.append(st)

    return targets