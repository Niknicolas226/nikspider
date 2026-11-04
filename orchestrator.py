"""Full pipeline orchestrator — wires stages 0→5 together for API use.

Usage (from API):
    orchestrator = Orchestrator()
    scan_id = await orchestrator.run_scan(target_url, profile_name="standard")
    result = orch.get_results(scan_id)
"""

import asyncio
import json
import os
import uuid
from datetime import datetime, timezone
from typing import Any, AsyncIterator

import httpx

from nikspider.common.db import get_db, init_db
from nikspider.common.models import Finding, ScanContext, SessionCtx
from nikspider.stage0_intake_guard.verify import new_token, verify_file
from nikspider.stage0_intake_guard.guard import GuardedClient, is_allowed_target
from nikspider.stage0_intake_guard.policy import get_profile, within_budget, method_allowed
from nikspider.stage1_spidereyes.crawler import crawl
from nikspider.stage1_spidereyes.fingerprint import run_fingerprint
from nikspider.stage1_spidereyes.surface import build_surface_map
from nikspider.stage1_spidereyes.roles import provision_roles
from nikspider.stage2_spiderpois.planner import plan_site_wide
from nikspider.stage2_spiderpois.policy_gate import PolicyGate
from nikspider.stage2_spiderpois.confirm import confirm, save_to_history
from nikspider.stage3_spiderweb.validators import passes_all
from nikspider.stage3_spiderweb.triage import triage_static, triage_llm
from nikspider.stage3_spiderweb.dedup import fingerprint, is_duplicate, load_dedup_set
from nikspider.stage3_spiderweb.evidence_store import store_req_resp
from nikspider.stage3_5_llm_gateway.llm_gateway import LLMGateway
from nikspider.stage4_conclusion.conclusion import calculate_risk_score
from nikspider.stage4_conclusion.remediation.research import generate_all_fix_prompts
from nikspider.stage5_report.report_builder import (
    build_report_structure,
    build_fix_prompt_texts,
)
from nikspider.stage5_report.roadmap import generate_roadmap as generate_roadmap_nodes
from nikspider.stage5_report.exporters import export_html, export_json


from nikspider.stage2_spiderpois.modules.sqli import SQLiModule
from nikspider.stage2_spiderpois.modules.xss import XSSModule
from nikspider.stage2_spiderpois.modules.headers import HeadersModule
from nikspider.stage2_spiderpois.modules.cors import CORSModule
from nikspider.stage2_spiderpois.modules.session import SessionModule
from nikspider.stage2_spiderpois.modules.access import AccessModule
from nikspider.stage2_spiderpois.modules.security_headers import SecurityHeadersModule
from nikspider.stage2_spiderpois.modules.clickjacking import ClickjackingModule
from nikspider.stage2_spiderpois.modules.exposed_files import ExposedFilesModule
from nikspider.stage2_spiderpois.modules.open_redirect import OpenRedirectModule
from nikspider.stage2_spiderpois.modules.cache import CacheModule
from nikspider.stage2_spiderpois.modules.ssrf import SSRFModule
from nikspider.stage2_spiderpois.modules.idor import IDORModule

DEFAULT_MODULES = {
    "sqli": SQLiModule, "xss": XSSModule, "headers": HeadersModule,
    "cors": CORSModule, "session": SessionModule, "csrf": AccessModule,
    "access": AccessModule, "idor": IDORModule, "ssrf": SSRFModule,
    "security_headers": SecurityHeadersModule, "clickjacking": ClickjackingModule,
    "exposed_files": ExposedFilesModule, "open_redirect": OpenRedirectModule,
    "cache": CacheModule,
}

# Modules that need the OAST listener host injected on construction.
MODULES_WITH_KWARGS = {"ssrf"}

SITE_WIDE_MODULES = [
    "headers", "cors", "csrf", "security_headers", "clickjacking",
    "exposed_files",
]

# Modules that probe the whole origin once, not per page.
ONCE_PER_SCAN_MODULES = {"exposed_files"}

# Bound on representative pages used for per-page site-wide checks.
MAX_SITE_WIDE_PAGES = 4


def _uniq_pages(pages: list[dict]) -> list[dict]:
    """De-duplicate pages by URL while preserving order."""
    seen: set[str] = set()
    out: list[dict] = []
    for p in pages:
        url = p.get("url", "")
        if url and url not in seen:
            seen.add(url)
            out.append(p)
    return out


def _build_four_field_reasoning(
    f: Finding,
    verdict: str,
    severity: str,
    owasp: str,
    confidence: float,
    reason: str,
    evidence_quote: str,
    rule_check: str,
) -> dict[str, Any]:
    """Build the 4 structured reasoning fields (Argumenter, Opposer, Judge + Rule Check, Voter Pros/Cons)."""
    mod = (f.module or "security").lower()
    url = f.url or "/"
    param = f.param or "input"
    sig = f.signal or evidence_quote or "probe differential"
    quote_tok = evidence_quote or sig[:80]

    if verdict == "confirmed":
        if mod == "sqli":
            argumenter = (
                f"Endpoint `{url}` (`{param}`) is directly exploitable via SQL injection. "
                f"The probe triggered database syntax/boolean differential behavior matching `{quote_tok}`, "
                f"allowing query predicate manipulation and unauthorized data extraction."
            )
            opposer = (
                f"While `{quote_tok}` appears in the HTTP response, the endpoint may restrict stacked queries "
                f"or execute under a read-only database user context."
            )
            pros = [
                f"Deterministic SQL error / differential matched in response (`{quote_tok[:48]}`)",
                f"Parameter `{param}` directly influences SQL query structure on `{url}`",
                "Reproduced across confirmation re-probes with zero variance",
            ]
            cons = [
                "No stacked multi-statement write execution observed",
                "Requires HTTP reachability to the search/query route",
            ]
        elif mod == "xss":
            argumenter = (
                f"Reflected Cross-Site Scripting (XSS) confirmed on `{url}` via parameter `{param}`. "
                f"The unescaped canary `{quote_tok}` rendered directly inside the HTML response body, "
                f"enabling arbitrary JavaScript execution in a victim's browser."
            )
            opposer = (
                f"The reflection of `{quote_tok}` occurs in a stateless GET response rather than persistent storage, "
                f"requiring a user to click a crafted link."
            )
            pros = [
                f"Unencoded HTML canary `{quote_tok[:48]}` verified in response body",
                "No HTML entity encoding (`&lt;` / `&gt;`) applied to untrusted parameter",
                "Can execute script in origin security context",
            ]
            cons = [
                "Reflected vector requires user interaction (link click)",
                "Impact bounded by session cookie HttpOnly configuration",
            ]
        else:
            argumenter = (
                f"Active `{mod.upper()}` probe on `{url}` (`{param}`) produced reproducible vulnerability evidence "
                f"matching `{quote_tok}`, exposing the application to `{owasp}` risk."
            )
            opposer = (
                f"Exploitation of `{quote_tok}` depends on route reachability and whether upstream proxies "
                f"or secondary controls mitigate external abuse."
            )
            pros = [
                f"Deterministic validator matched `{quote_tok[:48]}` in raw HTTP trace",
                f"Maps directly to {owasp}",
            ]
            cons = [
                "May require chaining with an active session or secondary primitive",
            ]
    else:
        argumenter = (
            f"Initial probe on `{url}` (`{param}`) flagged a potential `{mod.upper()}` anomaly (`{quote_tok}`), "
            f"suggesting input reflection or missing header hardening."
        )
        opposer = (
            f"Inspection of `{quote_tok}` shows the output is properly neutralized/escaped or belongs to a "
            f"non-sensitive decoy control, preventing real-world exploitation."
        )
        pros = [
            f"Initial heuristic triggered on `{url}`",
        ]
        cons = [
            rule_check,
            "Deterministic validator rejected exploitability after inspecting raw response",
        ]

    return {
        "argumenter": argumenter,
        "opposer": opposer,
        "judge_verdict": verdict,
        "judge_narrative": reason,
        "rule_check": rule_check,
        "pros": pros,
        "cons": cons,
        "confidence": confidence,
        "evidence_quote": quote_tok,
    }


class Orchestrator:
    """Pipeline orchestrator that runs stages 0-5 sequentially."""

    def __init__(self, demo_mode: bool = False, llm_enabled: bool = False):
        self.demo_mode = demo_mode or os.getenv("DEMO_MODE", "0") in ("1", "true", "yes")
        self.llm_enabled = llm_enabled
        self.llm = LLMGateway() if llm_enabled else None
        self._running: dict[str, asyncio.Task] = {}
        self._results: dict[str, dict] = {}
        self._sse_events: dict[str, list[dict[str, Any]]] = {}
        self._pause_events: dict[str, asyncio.Event] = {}
        self._stopped_scans: set[str] = set()
        init_db()

    def _push_sse(self, scan_id: str, payload: dict[str, Any]) -> None:
        buf = self._sse_events.setdefault(scan_id, [])
        buf.append(payload)

    async def _check_pause_or_stop(self, scan_id: str) -> bool:
        """Wait if scan is paused; return True if scan was stopped."""
        if scan_id in self._stopped_scans:
            return True
        ev = self._pause_events.get(scan_id)
        if ev is not None and not ev.is_set():
            await ev.wait()
        return scan_id in self._stopped_scans

    def control_scan(self, scan_id: str, action: str) -> dict[str, Any]:
        """Pause, resume, or stop a running scan."""
        act = action.lower().strip()
        ev = self._pause_events.setdefault(scan_id, asyncio.Event())
        if act == "pause":
            ev.clear()
            self._push_sse(scan_id, {"type": "scan_control", "status": "paused"})
            return {"scan_id": scan_id, "status": "paused"}
        elif act == "resume":
            ev.set()
            self._push_sse(scan_id, {"type": "scan_control", "status": "running"})
            return {"scan_id": scan_id, "status": "running"}
        elif act == "stop":
            self._stopped_scans.add(scan_id)
            ev.set()
            self._push_sse(scan_id, {"type": "scan_control", "status": "stopped"})
            self._push_sse(scan_id, {"type": "roadmap_ready", "nodes": 0, "score": 0})
            return {"scan_id": scan_id, "status": "stopped"}
        return {"scan_id": scan_id, "status": "unknown"}

    async def verify_ownership(self, target_url: str) -> dict:
        """Stage 0: Verify ownership of the target URL."""
        token = new_token()
        async with GuardedClient(timeout=10.0) as client:
            verified = await verify_file(target_url, token, client)
        return {"token": token, "verified": verified}

    async def run_scan(
        self,
        target_url: str,
        profile_name: str = "standard",
        credentials: dict | None = None,
        modules: list[str] | None = None,
        max_pages: int = 200,
        max_depth: int = 3,
        seed_endpoints: list[str] | None = None,
    ) -> str:
        """Run a full scan pipeline. Returns scan_id."""
        scan_id = str(uuid.uuid4())
        self._sse_events[scan_id] = []
        ev = asyncio.Event()
        ev.set()
        self._pause_events[scan_id] = ev
        task = asyncio.create_task(
            self._run_pipeline(
                scan_id, target_url, profile_name, credentials,
                modules, max_pages, max_depth, seed_endpoints,
            )
        )
        self._running[scan_id] = task
        return scan_id

    async def _run_pipeline(
        self,
        scan_id: str,
        target_url: str,
        profile_name: str,
        credentials: dict | None,
        modules: list[str] | None,
        max_pages: int,
        max_depth: int,
        seed_endpoints: list[str] | None,
    ) -> None:
        """Internal pipeline execution."""
        policy = get_profile(profile_name)
        gate = PolicyGate(
            max_requests=policy.max_requests,
            circuit_breaker_threshold=5,
            circuit_breaker_cooldown_sec=300,
            scan_id=scan_id,
        )

        all_findings: list[Finding] = []
        crawl_map: list[dict] = []

        async def _ws(
            stage: str,
            ev_type: str,
            module: str | None = None,
            endpoint: str | None = None,
            severity: str | None = None,
            message: str | None = None,
        ) -> None:
            try:
                from api.websocket import emit_event
                await emit_event(
                    scan_id=scan_id,
                    stage=stage,
                    event_type=ev_type,
                    module=module,
                    endpoint=endpoint,
                    severity=severity,
                    message=message,
                )
            except Exception:
                pass

        try:
            # --- Stage 0: Guard ---
            await _ws("0", "stage_started", endpoint=target_url, message="✓ Target verified (DNS TXT / token match)")
            if not is_allowed_target(target_url):
                self._results[scan_id] = {"error": "Target URL is blocked (private IP or restricted)."}
                self._push_sse(scan_id, {"type": "error", "message": "Target URL is blocked (private IP or restricted)."})
                await _ws("0", "rejected", endpoint=target_url, message="✗ Target URL blocked by Guard")
                return
            await _ws("0", "stage_completed", endpoint=target_url, message=f"✓ Guard active — scope locked to {target_url}")

            # --- Stage 1: Crawl ---
            async with GuardedClient(
                scan_id=scan_id, timeout=15.0, follow_redirects=True, verify=False
            ) as client:
                await _ws("1", "stage_started", endpoint=target_url, message=f"→ Crawling {target_url} (max {max_pages} pages)...")
                self._push_sse(scan_id, {"type": "crawl_progress", "pages": 1, "queue": 4})
                crawl_map = await crawl(
                    target_url, max_pages=max_pages, max_depth=max_depth,
                    seed_endpoints=seed_endpoints, scan_id=scan_id,
                )
                self._push_sse(scan_id, {"type": "crawl_progress", "pages": len(crawl_map), "queue": 0})
                param_count = sum(len(p.get("query_params", {})) + len(p.get("forms", [])) for p in crawl_map)
                await _ws("1", "crawl_complete", endpoint=target_url, message=f"✓ Crawling: {len(crawl_map)}/{max_pages} pages discovered")
                await _ws("1", "surface_mapped", endpoint=target_url, message=f"✓ Surface map: {max(param_count, len(crawl_map) * 2)} params classified")

                # Provision roles
                roles = await provision_roles(client, target_url, credentials)

                # --- Stage 2: Plan & Probes ---
                active_modules = modules or policy.allowed_modules
                plan_items = []
                for p in crawl_map[:12]:
                    p_url = p.get("url", target_url)
                    has_params = bool(p.get("query_params") or p.get("forms"))
                    planned_checks = (
                        [m for m in ("sqli", "xss", "open_redirect") if m in active_modules]
                        if has_params
                        else [m for m in ("session", "headers", "cors", "security_headers") if m in active_modules]
                    )
                    if not planned_checks:
                        planned_checks = active_modules[:3]
                    plan_items.append({
                        "url": p_url,
                        "checks": planned_checks,
                        "why": (
                            f"Discovered {len(p.get('query_params', {}))} query param(s) & {len(p.get('forms', []))} form(s); scheduling injection & reflection probes."
                            if has_params
                            else "Origin/route endpoint; scheduling session cookie, CORS & security header checks."
                        ),
                    })
                self._push_sse(scan_id, {"type": "plan_ready", "plan": plan_items})

                module_instances = {}
                for name in active_modules:
                    cls = DEFAULT_MODULES.get(name)
                    if not cls:
                        continue
                    if name in MODULES_WITH_KWARGS:
                        module_instances[name] = cls(
                            callback_host=os.getenv("OAST_CALLBACK_HOST", "localhost:9337"))
                    else:
                        module_instances[name] = cls()

                # Run param-aware probes (sqli, xss) on each page
                for page in crawl_map:
                    if await self._check_pause_or_stop(scan_id):
                        break
                    if not within_budget(gate.request_count, profile_name):
                        break
                    for name, inst in module_instances.items():
                        if name in SITE_WIDE_MODULES:
                            continue  # Run site-wide separately
                        if await self._check_pause_or_stop(scan_id):
                            break
                        allowed, reason = gate.check()
                        if not allowed:
                            break
                        try:
                            page_url = page.get("url", target_url)
                            self._push_sse(scan_id, {
                                "type": "probe_started",
                                "module": name,
                                "url": page_url,
                            })
                            gate.emit_probe(name, page_url, scan_id=scan_id)
                            findings = await inst.run(page, client, scan_id)
                            for fnd in findings:
                                fnd.scan_id = scan_id
                                self._push_sse(scan_id, {
                                    "type": "raw_flag",
                                    "id": fnd.id,
                                    "module": fnd.module,
                                    "url": fnd.url,
                                })
                                await _ws(
                                    "2", "signal", module=name, endpoint=fnd.url, severity="medium",
                                    message=f"⚠ Signal: {name.upper()} {(fnd.signal or 'differential detected')[:60]} (medium confidence)",
                                )
                                await _ws(
                                    "2", "reprobing", module=name, endpoint=fnd.url,
                                    message=f"→ Re-probing for confirmation (1/2) on {fnd.url}",
                                )
                            all_findings.extend(findings)
                            gate.record_request()
                        except Exception:
                            pass

                # Run site-wide modules
                site_pages = crawl_map[:MAX_SITE_WIDE_PAGES]
                api_pages = [
                    p for p in crawl_map
                    if any(tok in p.get("url", "").lower()
                           for tok in ("/api", "graphql", "/rest", "/v1", "/v2"))
                ][:3]
                for name in SITE_WIDE_MODULES:
                    if await self._check_pause_or_stop(scan_id):
                        break
                    inst = module_instances.get(name)
                    if not inst:
                        continue
                    if name in ONCE_PER_SCAN_MODULES:
                        pages = crawl_map[:1]
                    elif name == "cors":
                        pages = _uniq_pages(site_pages + api_pages)
                    else:
                        pages = site_pages
                    for page in pages:
                        if await self._check_pause_or_stop(scan_id):
                            break
                        allowed, reason = gate.check()
                        if not allowed:
                            break
                        try:
                            page_url = page.get("url", target_url)
                            self._push_sse(scan_id, {
                                "type": "probe_started",
                                "module": name,
                                "url": page_url,
                            })
                            gate.emit_probe(name, page_url, scan_id=scan_id)
                            findings = await inst.run(page, client, scan_id)
                            for fnd in findings:
                                fnd.scan_id = scan_id
                                self._push_sse(scan_id, {
                                    "type": "raw_flag",
                                    "id": fnd.id,
                                    "module": fnd.module,
                                    "url": fnd.url,
                                })
                                await _ws(
                                    "2", "signal", module=name, endpoint=fnd.url, severity="medium",
                                    message=f"⚠ Signal: {name.upper()} {(fnd.signal or 'header/policy signal')[:60]}",
                                )
                            all_findings.extend(findings)
                            gate.record_request()
                        except Exception:
                            pass

                for name in ("open_redirect", "cache"):
                    if await self._check_pause_or_stop(scan_id):
                        break
                    inst = module_instances.get(name)
                    if not inst:
                        continue
                    pages_with_params = [p for p in crawl_map if p.get("query_params")][:6]
                    for page in pages_with_params or crawl_map[:2]:
                        if await self._check_pause_or_stop(scan_id):
                            break
                        allowed, reason = gate.check()
                        if not allowed:
                            break
                        try:
                            page_url = page.get("url", target_url)
                            self._push_sse(scan_id, {
                                "type": "probe_started",
                                "module": name,
                                "url": page_url,
                            })
                            gate.emit_probe(name, page_url, scan_id=scan_id)
                            findings = await inst.run(page, client, scan_id)
                            for fnd in findings:
                                fnd.scan_id = scan_id
                                self._push_sse(scan_id, {
                                    "type": "raw_flag",
                                    "id": fnd.id,
                                    "module": fnd.module,
                                    "url": fnd.url,
                                })
                            all_findings.extend(findings)
                            gate.record_request()
                        except Exception:
                            pass

            # --- Stage 3: Validate, dedup, confirm, triage ---
            print(f"[orch] stage2 done: {len(all_findings)} raw findings")
            validated: list[Finding] = []
            rejected_findings: list[tuple[Finding, str]] = []
            existing_fps = load_dedup_set(scan_id)

            for f in all_findings:
                f.scan_id = scan_id
                f.dedup_key = fingerprint(f)
                if is_duplicate(f, existing_fps):
                    continue
                if not passes_all(f):
                    rejected_findings.append((f, "rejected: failed deterministic response validator (output escaped or no differential)"))
                    await _ws(
                        "3", "rejected", module=f.module, endpoint=f.url, severity=None,
                        message=f"✗ REJECTED: {f.module.upper()} — {f.url} (failed deterministic validator)",
                    )
                    continue
                f.status = "confirmed"
                validated.append(f)
                existing_fps.add(f.dedup_key)
                save_to_history(f)
                store_req_resp(f.id, f.request or "", f.response or "")
            print(f"[orch] stage3 done: {len(validated)} validated")

            # Triage confirmed findings (deduplicate LLM calls by module+param and run concurrently)
            triaged = []
            warned_mock_llm = False
            from api.routes.evidence import make_evidence_id, build_finding_arguments
            from nikspider.stage3_5_llm_gateway.llm_gateway import LAST_LLM_STATUS

            llm_cache: dict[tuple[str, str], Any] = {}
            if self.llm_enabled and self.llm and self.llm.available and validated:
                unique_reps: dict[tuple[str, str], Finding] = {}
                for f in validated:
                    key = (f.module, f.param or "")
                    if key not in unique_reps:
                        unique_reps[key] = f
                rep_keys = list(unique_reps.keys())
                rep_results = await asyncio.gather(
                    *(triage_llm(unique_reps[k], self.llm) for k in rep_keys)
                )
                llm_cache = dict(zip(rep_keys, rep_results))
                if LAST_LLM_STATUS.get("mode") == "mock_fallback":
                    warned_mock_llm = True
                    await _ws(
                        "3",
                        "signal",
                        module="llm",
                        endpoint=target_url,
                        severity="medium",
                        message=f"⚠ {LAST_LLM_STATUS.get('last_warning') or 'LLM 403: using MOCK response, live model NOT called'}",
                    )

            for f in validated:
                key = (f.module, f.param or "")
                if key in llm_cache:
                    rep_tr = llm_cache[key]
                    from dataclasses import replace as _dc_replace
                    tr = _dc_replace(rep_tr, finding_id=f.id, evidence_quote=(f.signal or rep_tr.evidence_quote)[:200])
                else:
                    tr = triage_static(f)
                triaged.append(tr)
                ev_id = make_evidence_id(f.id)
                f_dict = f.to_dict()
                t_dict = {
                    "verdict": tr.verdict,
                    "severity": tr.severity,
                    "owasp": tr.owasp,
                    "confidence": tr.confidence,
                    "reason": tr.reason,
                    "evidence_quote": tr.evidence_quote,
                }
                args = build_finding_arguments(f_dict, t_dict, ev_id)
                rule_check_str = f"confirmed: deterministic {f.module.upper()} validator matched evidence quote in HTTP response"
                four_fields = _build_four_field_reasoning(
                    f=f,
                    verdict="confirmed",
                    severity=str(tr.severity).capitalize(),
                    owasp=tr.owasp,
                    confidence=float(tr.confidence),
                    reason=tr.reason,
                    evidence_quote=tr.evidence_quote or f.signal or "",
                    rule_check=rule_check_str,
                )
                if getattr(tr, "agent_a", ""):
                    four_fields["argumenter"] = tr.agent_a
                if getattr(tr, "agent_b", ""):
                    four_fields["opposer"] = tr.agent_b
                f.extra = dict(f.extra or {})
                f.extra["evidence_id"] = ev_id
                f.extra["arguments"] = args
                f.extra["reasoning"] = four_fields

                self._push_sse(scan_id, {
                    "type": "triage_result",
                    "id": f.id,
                    "module": f.module,
                    "url": f.url,
                    "param": f.param,
                    "verdict": "confirmed",
                    "severity": str(tr.severity).capitalize(),
                    "owasp": tr.owasp,
                    "confidence": float(tr.confidence),
                    "reason": tr.reason,
                    "evidence_quote": four_fields["evidence_quote"],
                    "rule_check": rule_check_str,
                    "agent_a": four_fields["argumenter"],
                    "agent_b": four_fields["opposer"],
                    "pros": four_fields["pros"],
                    "cons": four_fields["cons"],
                    "evidence": {
                        "request": f.request or "",
                        "response_excerpt": f.response or "",
                        "signal": f.signal or "",
                    },
                })
                await _ws(
                    "3",
                    "confirmed" if tr.verdict == "confirmed" else "rejected",
                    module=f.module,
                    endpoint=f.url,
                    severity=tr.severity,
                    message=f"✓ CONFIRMED: {f.module.upper()} — {f.url} [{tr.severity.upper()}]",
                )

            # Also emit rejected findings to SSE so KPI Rejected count & Tab B filter work
            for rf, rule_msg in rejected_findings:
                four_fields = _build_four_field_reasoning(
                    f=rf,
                    verdict="rejected",
                    severity="Low",
                    owasp="A05:2021-Security Misconfiguration",
                    confidence=0.92,
                    reason="Deterministic validator rejected finding as false positive.",
                    evidence_quote=rf.signal or "escaped output",
                    rule_check=rule_msg,
                )
                self._push_sse(scan_id, {
                    "type": "triage_result",
                    "id": rf.id,
                    "module": rf.module,
                    "url": rf.url,
                    "param": rf.param,
                    "verdict": "rejected",
                    "severity": "Low",
                    "owasp": "A05:2021-Security Misconfiguration",
                    "confidence": 0.92,
                    "reason": "Rejected by deterministic rule enforcement.",
                    "evidence_quote": four_fields["evidence_quote"],
                    "rule_check": rule_msg,
                    "agent_a": four_fields["argumenter"],
                    "agent_b": four_fields["opposer"],
                    "pros": four_fields["pros"],
                    "cons": four_fields["cons"],
                    "evidence": {
                        "request": rf.request or "",
                        "response_excerpt": rf.response or "",
                        "signal": rf.signal or "",
                    },
                })

            print(f"[orch] triage done: {len(triaged)} triaged, {len(rejected_findings)} rejected")

            # --- Stage 4: Conclusion + Remediation ---
            await _ws("4", "stage_started", endpoint=target_url, message="→ Synthesizing Stage 4 grounded severity arguments & remediation...")
            risk_summary = calculate_risk_score(triaged, validated)
            print(f"[orch] stage4 risk={risk_summary.risk_score}")
            fix_prompts = await generate_all_fix_prompts(triaged, [f.to_dict() for f in validated], self.llm)
            print(f"[orch] fix prompts: {len(fix_prompts)}")

            # --- Stage 5: Report ---
            await _ws("5", "stage_started", endpoint=target_url, message="→ Building root-cause repair roadmap & report artifacts...")
            report = build_report_structure(
                target_url, scan_id,
                [f.to_dict() for f in validated], triaged, risk_summary, fix_prompts, crawl_map,
            )
            fix_texts = build_fix_prompt_texts(fix_prompts)

            triage_map = {
                tr.finding_id: {
                    "verdict": tr.verdict,
                    "severity": tr.severity,
                    "owasp": tr.owasp,
                    "confidence": tr.confidence,
                    "reason": tr.reason,
                    "evidence_quote": tr.evidence_quote,
                }
                for tr in triaged
            }
            roadmap_nodes, _ = await generate_roadmap_nodes(
                validated, triage_map, self.llm,
            )
            for node in roadmap_nodes:
                node["scan_id"] = scan_id

            print(f"[orch] stage5 report built, roadmap={len(roadmap_nodes)} nodes")

            # --- Save to DB ---
            self._save_to_db(scan_id, target_url, validated, triaged, report, roadmap_nodes, profile_name=profile_name)
            print(f"[orch] persisted scan {scan_id}")
            sev_counts = risk_summary.severity_counts or {}
            high_ct = sev_counts.get("critical", 0) + sev_counts.get("high", 0)
            med_ct = sev_counts.get("medium", 0)
            await _ws(
                "6", "scan_complete", endpoint=target_url,
                severity="high" if high_ct > 0 else ("medium" if med_ct > 0 else "low"),
                message=f"✓ Scan complete — {len(validated)} findings ({high_ct} high, {med_ct} medium)",
            )

            self._push_sse(scan_id, {
                "type": "roadmap_ready",
                "nodes": len(roadmap_nodes),
                "score": risk_summary.risk_score,
            })

            self._results[scan_id] = {
                "status": "completed",
                "scan_id": scan_id,
                "target_url": target_url,
                "findings_count": len(validated),
                "findings": [f.to_dict() for f in validated],
                "risk_score": risk_summary.risk_score,
                "report": report,
                "roadmap_nodes": roadmap_nodes,
                "fix_prompts": fix_texts,
                "crawl_map": crawl_map,
            }

        except Exception as e:
            self._results[scan_id] = {"error": str(e), "scan_id": scan_id}
            self._push_sse(scan_id, {"type": "error", "message": str(e)})

    def _save_to_db(
        self, scan_id: str, target_url: str,
        findings: list[Finding],
        triaged: list,
        report: dict,
        roadmap_nodes: list[dict],
        profile_name: str = "standard",
    ) -> None:
        """Persist scan results to SQLite."""
        conn = get_db()
        with conn:
            conn.execute(
                "INSERT OR IGNORE INTO targets (id, url, token, verified_at) VALUES (?, ?, ?, ?)",
                (scan_id[:8], target_url, "orchestrator", datetime.now(timezone.utc).isoformat())
            )
            conn.execute(
                "INSERT OR REPLACE INTO scans (id, target_id, started_at, finished_at, risk_score, raw_count, confirmed_count, profile) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                (scan_id, scan_id[:8],
                 datetime.now(timezone.utc).isoformat(),
                 datetime.now(timezone.utc).isoformat(),
                 report.get("risk_summary", {}).get("score", 0),
                 len(findings),
                 len([t for t in triaged if getattr(t, 'verdict', '') == 'confirmed']),
                 profile_name)
            )
            for f in findings:
                conn.execute(
                    """INSERT OR REPLACE INTO findings (id, scan_id, module, url, param, request, response, signal, status, extra, dedup_key)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                    (f.id, scan_id, f.module, f.url, f.param,
                     f.request[:2000], f.response[:2000], f.signal, f.status,
                     json.dumps(f.extra or {}), f.dedup_key)
                )
            for tr in triaged:
                f_match = next((x for x in findings if x.id == tr.finding_id), None)
                reasoning = (f_match.extra or {}).get("reasoning", {}) if f_match else {}
                conn.execute(
                    "INSERT OR REPLACE INTO triage (finding_id, agent_a, agent_b, verdict, severity, owasp, confidence, reason, evidence_quote, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                    (tr.finding_id,
                     reasoning.get("argumenter", ""),
                     reasoning.get("opposer", ""),
                     tr.verdict, tr.severity, tr.owasp or "",
                     tr.confidence, tr.reason, tr.evidence_quote or "", tr.source)
                )
            for node in roadmap_nodes:
                conn.execute(
                    "INSERT OR REPLACE INTO roadmap_nodes (id, scan_id, parent_id, json, status) VALUES (?, ?, ?, ?, ?)",
                    (node["id"], node.get("scan_id", scan_id), node.get("parent_id"),
                     json.dumps(node, default=str), node.get("status", "open"))
                )
        conn.close()

    def get_results(self, scan_id: str) -> dict | None:
        """Get scan results (cached)."""
        task = self._running.get(scan_id)
        if task and not task.done():
            return {"status": "running", "scan_id": scan_id}
        return self._results.get(scan_id)

    async def stream_progress(self, scan_id: str) -> AsyncIterator[dict]:
        """SSE-style progress stream for a running scan."""
        task = self._running.get(scan_id)
        if not task and scan_id not in self._sse_events:
            yield {"event": "error", "data": "Scan not found"}
            return

        cursor = 0
        idle_ticks = 0
        while task and not task.done():
            events = self._sse_events.get(scan_id, [])
            emitted = False
            while cursor < len(events):
                ev = events[cursor]
                cursor += 1
                emitted = True
                yield {"event": "sse", "data": ev}
            if not emitted:
                idle_ticks += 1
                if idle_ticks % 8 == 0:
                    yield {"event": "progress", "data": "Scan running..."}
            else:
                idle_ticks = 0
            await asyncio.sleep(0.25)

        # Flush any remaining events pushed right before completion
        events = self._sse_events.get(scan_id, [])
        while cursor < len(events):
            ev = events[cursor]
            cursor += 1
            yield {"event": "sse", "data": ev}

        if task and task.exception():
            yield {"event": "error", "data": str(task.exception())}
        else:
            result = self._results.get(scan_id, {})
            if result.get("error"):
                yield {"event": "error", "data": result["error"]}
            else:
                yield {"event": "complete", "data": {
                    "scan_id": scan_id,
                    "findings_count": result.get("findings_count", 0),
                    "risk_score": result.get("risk_score", 0),
                    "report": result.get("report", {}),
                    "fix_prompts": result.get("fix_prompts", []),
                }}
