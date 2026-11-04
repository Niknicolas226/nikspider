"""Planner — decides which modules run against which surface target.

Before running probes:
  1. Collect surface targets with param → sink classification
  2. Filter by profile policy
  3. Check dedup history
  4. Return a plan: list of (module, surface_id) pairs
"""

from typing import Any
from nikspider.stage0_intake_guard.policy import is_module_allowed
from nikspider.stage2_spiderpois.modules.sqli import SQLiModule
from nikspider.stage2_spiderpois.modules.xss import XSSModule
from nikspider.stage2_spiderpois.modules.headers import HeadersModule
from nikspider.stage2_spiderpois.modules.cors import CORSModule
from nikspider.stage2_spiderpois.modules.session import SessionModule
from nikspider.stage2_spiderpois.modules.access import AccessModule
from nikspider.stage2_spiderpois.modules.idor import IDORModule
from nikspider.stage2_spiderpois.modules.ssrf import SSRFModule
from nikspider.common.models import SurfaceTarget

# Sink → relevant modules mapping
SINK_TO_MODULES = {
    "sql":       {"sqli"},
    "html":      {"xss"},
    "html_attr": {"xss"},
    "js":        {"xss"},
    "url":       {"open_redirect", "ssrf", "idor"},
    "path":      {"idor", "exposed_files"},
    "file":      {"exposed_files"},
    "header":    {"headers"},
    "template":  {"xss", "sqli"},
    "json":      {"sqli"},
    "none":      set(),
    "unknown":   {"sqli", "xss"},  # try both if uncertain
}

# Site-wide modules (don't need a specific surface target)
SITE_WIDE_MODULES = {
    "headers": HeadersModule,
    "cors": CORSModule,
    "session": SessionModule,
    "csrf": AccessModule,
    "security_headers": None,  # handled by headers
    "clickjacking": None,
    "exposed_files": None,
    "open_redirect": None,
    "cache": None,
}

DEFAULT_MODULES = {
    "sqli": SQLiModule,
    "xss": XSSModule,
    "headers": HeadersModule,
    "cors": CORSModule,
    "session": SessionModule,
    "csrf": AccessModule,
    "idor": IDORModule,
    "ssrf": SSRFModule,
}


def _resolve_modules(module_names: list[str]) -> dict[str, type]:
    """Resolve module names to classes."""
    resolved = {}
    for name in module_names:
        cls = DEFAULT_MODULES.get(name)
        if cls:
            resolved[name] = cls
    return resolved


def plan_surface_targets(
    surfaces: list[SurfaceTarget],
    module_names: list[str] | None = None,
    profile: str = "standard",
) -> list[dict]:
    """Generate a list of (module_name, surface_target, surface_id) pairs.

    For each surface target and each of its params, decide which modules to run
    based on sink classification and profile policy.
    """
    plan = []
    modules = module_names or list(DEFAULT_MODULES.keys())

    for surface in surfaces:
        if not surface.params:
            continue
        for param in surface.params:
            sink = param.sink or "unknown"
            candidates = SINK_TO_MODULES.get(sink, {"sqli", "xss"})
            for mod_name in candidates:
                if mod_name in modules and is_module_allowed(mod_name, profile):
                    plan.append({
                        "module": mod_name,
                        "surface_id": surface.id,
                        "surface": surface,
                        "param": param,
                    })
    return plan


def plan_site_wide(
    url: str,
    module_names: list[str] | None = None,
    profile: str = "standard",
) -> list[str]:
    """Return list of site-wide module names to run for a given URL."""
    modules = module_names or list(DEFAULT_MODULES.keys())
    return [m for m in modules
            if m in SITE_WIDE_MODULES and is_module_allowed(m, profile)]

# --------------------------------------------------------------------------
# Backward-compatible planner API (module-name based, LLM optional)
# --------------------------------------------------------------------------

BASELINE_SITE_CHECKS = {
    "security_headers", "clickjacking", "cors", "cache", "exposed_files",
}

ALLOWED_CHECKS = {
    "sqli", "xss", "session", "access", "idor", "csrf", "ssrf",
} | BASELINE_SITE_CHECKS | {"headers", "open_redirect"}


def _ensure_checks(plan: list[dict], crawl_map: list[dict]) -> list[dict]:
    """Deterministic floor: baseline checks always run, page hints add others."""
    by_url = {p.get("url"): p for p in crawl_map}
    out, seen = [], set()
    for item in plan:
        url = item["url"]
        checks = set(item.get("checks", [])) | BASELINE_SITE_CHECKS
        page = by_url.get(url, {})
        if page.get("forms"):
            checks.add("csrf")
        lowered = url.lower()
        if "redirect" in lowered or any(k in lowered for k in ("next=", "return=", "url=")):
            checks.add("open_redirect")
            checks.add("ssrf")
        out.append({**item, "checks": sorted(checks & ALLOWED_CHECKS)})
        seen.add(url)
    for p in crawl_map:
        if p.get("url") not in seen:
            out.append({
                "url": p.get("url"),
                "checks": sorted(BASELINE_SITE_CHECKS),
                "why": "Baseline site-wide checks (not selected by planner)",
            })
    return out


async def plan_scans(crawl_map: list[dict], cfg: dict | None = None,
                     llm=None) -> list[dict]:
    """Plan per-URL checks. LLM-assisted when a gateway is supplied.

    Always returns a plan covering every crawled URL with at least the
    baseline site-wide checks.
    """
    import json
    import re

    plan: list[dict] = []
    if llm is not None and getattr(llm, "available", False):
        compact = [
            {
                "url": p.get("url"),
                "status": p.get("status"),
                "query_params": p.get("query_params", []),
                "forms": [
                    {"action": f.get("action"), "method": f.get("method"),
                     "inputs": f.get("inputs")}
                    for f in p.get("forms", [])
                ],
            }
            for p in crawl_map[:30]
        ]
        prompt = (
            "You are the NikSpider Security Test Planner. Choose which checks to "
            f"run per URL. Allowed checks: {json.dumps(sorted(ALLOWED_CHECKS))}.\n"
            "Return strict JSON only: [{\"url\": ..., \"checks\": [...], \"why\": ...}]\n"
            f"Crawl map:\n{json.dumps(compact)}"
        )
        try:
            text = await llm.acomplete(prompt)
            match = re.search(r"\[.*\]", text, re.S)
            if match:
                raw = json.loads(match.group())
                plan = [
                    {"url": it["url"],
                     "checks": [c for c in it.get("checks", [])
                                if c in ALLOWED_CHECKS],
                     "why": it.get("why", "")}
                    for it in raw
                    if isinstance(it, dict) and it.get("url")
                ]
        except Exception:
            plan = []

    if not plan:
        # Deterministic: param pages get injection checks, forms get csrf.
        for p in crawl_map:
            checks = set(BASELINE_SITE_CHECKS)
            if p.get("query_params"):
                checks |= {"sqli", "xss"}
            if p.get("forms"):
                checks.add("csrf")
            plan.append({"url": p.get("url"), "checks": sorted(checks),
                         "why": "Heuristic plan (no planner LLM)"})

    return _ensure_checks(plan, crawl_map)


create_test_plan = plan_scans
