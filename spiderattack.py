#!/usr/bin/env python3
"""NikSpider site‑wide Attack orchestrator — CLI entry point for Stages 0‑3.

Run all vulnerability probes against every page discovered by the crawler.
Outputs raw findings (status="raw") for downstream triage and reporting.

Usage:
    python -m nikspider.spiderattack https://example.com
    python -m nikspider.spiderattack https://example.com --profile aggressive
    python -m nikspider.spiderattack https://example.com --module sqli,xss,ssrf
"""

import argparse
import asyncio
import json
import os
import sys
import uuid
from datetime import datetime, timezone
from typing import Any

import httpx

# Allow running from the repository root
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from nikspider.common.models import Finding, ScanContext, SessionCtx, TestAccount
from nikspider.common.db import get_db, init_db, log_request
from nikspider.stage0_intake_guard.guard import GuardedClient, is_allowed_target
from nikspider.stage0_intake_guard.policy import get_profile, is_module_allowed, within_budget
from nikspider.stage1_spidereyes.crawler import crawl
from nikspider.stage1_spidereyes.roles import provision_roles
from nikspider.stage2_spiderpois.policy_gate import PolicyGate

# Module imports
from nikspider.stage2_spiderpois.modules.sqli import SQLiModule
from nikspider.stage2_spiderpois.modules.xss import XSSModule
from nikspider.stage2_spiderpois.modules.headers import HeadersModule
from nikspider.stage2_spiderpois.modules.cors import CORSModule
from nikspider.stage2_spiderpois.modules.session import SessionModule
from nikspider.stage2_spiderpois.modules.access import AccessModule
from nikspider.stage2_spiderpois.modules.idor import IDORModule
from nikspider.stage2_spiderpois.modules.ssrf import SSRFModule
from nikspider.stage2_spiderpois.modules.security_headers import SecurityHeadersModule
from nikspider.stage2_spiderpois.modules.clickjacking import ClickjackingModule
from nikspider.stage2_spiderpois.modules.exposed_files import ExposedFilesModule
from nikspider.stage2_spiderpois.modules.open_redirect import OpenRedirectModule
from nikspider.stage2_spiderpois.modules.cache import CacheModule

ALL_MODULES = {
    "sqli": SQLiModule,
    "xss": XSSModule,
    "headers": HeadersModule,
    "cors": CORSModule,
    "session": SessionModule,
    "csrf": AccessModule,
    "idor": IDORModule,
    "ssrf": SSRFModule,
    "security_headers": SecurityHeadersModule,
    "clickjacking": ClickjackingModule,
    "exposed_files": ExposedFilesModule,
    "open_redirect": OpenRedirectModule,
    "cache": CacheModule,
}

SITE_WIDE_CHECKS = [
    "headers", "cors", "csrf", "session", "security_headers",
    "clickjacking", "exposed_files",
]

PER_PAGE_CHECKS = [
    "sqli", "xss", "idor", "ssrf", "open_redirect",
]


class SpiderAttack:
    """Site‑wide vulnerability scanner orchestration.

    Stages 0‑3 (no LLM, no report generation):
      0) Guard — IP safety check
      1) Crawl site → pages + forms + links
      2) Run probes against each page and site‑wide checks
      3) Raw triage — dedup + confirm only (no LLM debate)
    """

    def __init__(
        self,
        target_url: str,
        profile: str = "standard",
        modules: list[str] | None = None,
        max_pages: int = 200,
        max_depth: int = 3,
        seed_endpoints: list[str] | None = None,
        credentials: dict[str, dict] | None = None,
    ):
        self.target_url = target_url
        self.scan_id = str(uuid.uuid4())
        self.modules = modules
        self.max_pages = max_pages
        self.max_depth = max_depth
        self.seed_endpoints = seed_endpoints
        self.credentials = credentials
        self.policy = get_profile(profile)
        self.profile_name = profile
        self.crawl_map: list[dict] = []
        self.findings: list[Finding] = []
        self.gate = PolicyGate(
            max_requests=self.policy.max_requests,
        )

    async def run(self) -> dict:
        """Run stages 0‑3 and return a results dictionary."""
        init_db()

        results: dict[str, Any] = {
            "scan_id": self.scan_id,
            "target_url": self.target_url,
            "profile": self.profile_name,
            "started_at": datetime.now(timezone.utc).isoformat(),
            "findings": [],
            "crawl_pages": 0,
        }

        # --- Stage 0: Guard ---
        if not is_allowed_target(self.target_url):
            return {**results, "error": "Target URL is blocked (private or restricted IP)."}

        # --- Stage 1: Crawl ---
        print(f"[*] Crawling {self.target_url}...")
        async with GuardedClient(
            scan_id=self.scan_id, timeout=15.0, follow_redirects=True, verify=False
        ) as client:
            self.crawl_map = await crawl(
                self.target_url,
                max_pages=self.max_pages,
                max_depth=self.max_depth,
                seed_endpoints=self.seed_endpoints,
                scan_id=self.scan_id,
            )
            results["crawl_pages"] = len(self.crawl_map)
            print(f"[*] Crawled {len(self.crawl_map)} pages")

            # Provision roles if credentials supplied
            roles = {}
            if self.credentials:
                roles = await provision_roles(client, self.target_url, self.credentials)
                print(f"[*] Provisioned roles: {list(roles.keys())}")

            # Determine active modules
            if self.modules:
                active = [m for m in self.modules if m in ALL_MODULES and is_module_allowed(m, self.profile_name)]
            else:
                active = [m for m in self.policy.allowed_modules if m in ALL_MODULES]
            print(f"[*] Active modules: {active}")

            # --- Stage 2: Probes ---
            site_wide_active = [m for m in active if m in SITE_WIDE_CHECKS]
            per_page_active = [m for m in active if m in PER_PAGE_CHECKS]

            # Create module instances
            instances = {}
            for name in active:
                cls = ALL_MODULES[name]
                if name == "ssrf":
                    instances[name] = cls(
                        callback_host=os.getenv("OAST_CALLBACK_HOST", "localhost:9337"))
                else:
                    instances[name] = cls()

            # Run per-page probes
            for page in self.crawl_map:
                if self.gate.exhausted:
                    print("[!] Request budget exhausted, stopping probes")
                    break
                for name in per_page_active:
                    if self.gate.exhausted or self.gate.breaker_open:
                        break
                    allowed, reason = self.gate.check()
                    if not allowed:
                        break
                    try:
                        findings = await instances[name].run(page, client, self.scan_id)
                        if findings:
                            print(f"  [+] {page['url'][:60]} -> {name}: {len(findings)} finding(s)")
                        self.findings.extend(findings)
                        self.gate.record_request()
                    except Exception as e:
                        print(f"  [!] {page['url'][:60]} -> {name}: error - {e}")

            # Run site-wide checks. Origin-scope checks run once per scan;
            # the rest run on a bounded representative page sample (dedup
            # collapses duplicates, so crawling every page is unnecessary).
            ONCE_PER_SCAN = {"exposed_files"}
            sample = self.crawl_map[:4]
            for name in site_wide_active:
                inst = instances.get(name)
                if not inst:
                    continue
                pages = self.crawl_map[:1] if name in ONCE_PER_SCAN else sample
                for page in pages:
                    allowed, reason = self.gate.check()
                    if not allowed:
                        break
                    try:
                        findings = await inst.run(page, client, self.scan_id)
                        if findings:
                            print(f"  [+] site-wide {name}: {len(findings)} finding(s)")
                        self.findings.extend(findings)
                        self.gate.record_request()
                    except Exception as e:
                        print(f"  [!] site-wide {name}: error - {e}")

            # Run cache on a couple pages
            if "cache" in active:
                inst = instances.get("cache")
                if inst:
                    for page in self.crawl_map[:2]:
                        try:
                            findings = await inst.run(page, client, self.scan_id)
                            self.findings.extend(findings)
                        except Exception:
                            pass

        # --- Stage 3: Dedup + confirm (raw triage, no LLM) ---
        from nikspider.stage3_spiderweb.dedup import fingerprint, is_duplicate
        from nikspider.stage2_spiderpois.confirm import confirm as do_confirm
        from nikspider.stage3_spiderweb.validators import passes_all

        deduped: list[dict] = []
        seen_fps: set[str] = set()

        for f in self.findings:
            fp = fingerprint(f)
            if fp in seen_fps:
                continue
            if not passes_all(f):
                continue
            do_confirm(f, store_to_db=True)
            seen_fps.add(fp)
            deduped.append(f.to_dict())

        results["findings"] = deduped
        results["crawl_pages"] = len(self.crawl_map)
        results["finished_at"] = datetime.now(timezone.utc).isoformat()

        # Save to DB
        self._save_results(results)

        print(f"\n[*] Scan complete: {len(deduped)} unique findings from {len(self.crawl_map)} pages")
        return results

    def _save_results(self, results: dict) -> None:
        """Persist findings to SQLite."""
        try:
            conn = get_db()
            with conn:
                conn.execute(
                    "INSERT OR IGNORE INTO targets (id, url, token, verified_at) VALUES (?, ?, ?, ?)",
                    (self.scan_id[:8], self.target_url, "spiderattack_cli", datetime.now(timezone.utc).isoformat())
                )
                conn.execute(
                    "INSERT INTO scans (id, target_id, started_at, finished_at, risk_score, raw_count, confirmed_count, profile) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                    (self.scan_id, self.scan_id[:8],
                     results.get("started_at", ""),
                     results.get("finished_at", ""),
                     0, len(results.get("findings", [])), 0,
                     self.profile_name)
                )
                for f in results.get("findings", []):
                    conn.execute(
                        """INSERT OR REPLACE INTO findings (id, scan_id, module, url, param, request, response, signal, status, extra, dedup_key)
                           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                        (f.get("id", str(uuid.uuid4())), self.scan_id,
                         f.get("module", ""), f.get("url", ""), f.get("param", ""),
                         (f.get("request", "") or "")[:2000],
                         (f.get("response", "") or "")[:2000],
                         f.get("signal", ""), f.get("status", "raw"),
                         json.dumps(f.get("extra", {})), f.get("dedup_key", ""))
                    )
            conn.close()
        except Exception as e:
            print(f"[!] Failed to save results to DB: {e}", file=sys.stderr)


async def main_async() -> int:
    parser = argparse.ArgumentParser(description="NikSpider site-wide vulnerability scanner (Stages 0-3)")
    parser.add_argument("url", help="Target URL to scan")
    parser.add_argument("--profile", default="standard",
                       choices=["safe", "standard", "aggressive"],
                       help="Scan profile (default: standard)")
    parser.add_argument("--module", help="Comma-separated module names (overrides profile)")
    parser.add_argument("--max-pages", type=int, default=200, help="Max pages to crawl")
    parser.add_argument("--max-depth", type=int, default=3, help="Max crawl depth")
    parser.add_argument("--seed", action="append", help="Additional seed endpoints")
    parser.add_argument("--output", "-o", help="Output JSON file path")
    parser.add_argument("--json", action="store_true", help="Print results as JSON to stdout")
    args = parser.parse_args()

    modules = args.module.split(",") if args.module else None

    scanner = SpiderAttack(
        target_url=args.url,
        profile=args.profile,
        modules=modules,
        max_pages=args.max_pages,
        max_depth=args.max_depth,
        seed_endpoints=list(args.seed) if args.seed else None,
    )

    try:
        results = await scanner.run()
    except Exception as e:
        print(f"[!] Fatal error: {e}", file=sys.stderr)
        return 1

    if results.get("error"):
        print(f"[!] {results['error']}", file=sys.stderr)
        return 1

    if args.output:
        with open(args.output, "w", encoding="utf-8") as f:
            json.dump(results, f, indent=2, default=str)
        print(f"[*] Results written to {args.output}")

    if args.json:
        print(json.dumps(results, indent=2, default=str))

    return 0


def main() -> None:
    sys.exit(asyncio.run(main_async()))


if __name__ == "__main__":
    main()