"""Retest engine — re-run probes for confirmed findings to verify fixes.

Stages:
  1. Load confirmed findings
  2. Re-assemble the probe request
  3. Run the module's retest method
  4. Update finding status: "fixed", "still_open", "retest_error"
"""

import asyncio
from datetime import datetime, timezone
from typing import Any

import httpx

from nikspider.common.models import Finding
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
from nikspider.stage0_intake_guard.guard import GuardedClient
from nikspider.common.db import get_db

MODULE_CLASSES = {
    "sqli": SQLiModule,
    "xss": XSSModule,
    "headers": HeadersModule,
    "cors": CORSModule,
    "session": SessionModule,
    "access": AccessModule,
    "csrf": AccessModule,
    "idor": IDORModule,
    "ssrf": SSRFModule,
    "security_headers": SecurityHeadersModule,
    "clickjacking": ClickjackingModule,
    "exposed_files": ExposedFilesModule,
    "open_redirect": OpenRedirectModule,
    "cache": CacheModule,
}


async def retest_finding(
    finding,
    client: httpx.AsyncClient,
) -> dict:
    """Retest a single finding. Returns {finding_id, status, message}.

    Accepts either a Finding dataclass or an equivalent dict.
    """
    if not isinstance(finding, dict):
        finding = finding.to_dict()
    module_name = finding.get("module", "")
    cls = MODULE_CLASSES.get(module_name)
    if not cls:
        return {"finding_id": finding.get("id", ""), "status": "skipped",
                "message": f"No retest handler for module '{module_name}'"}

    instance = cls()
    try:
        fixed = await instance.retest(finding, client)
        if fixed:
            return {"finding_id": finding.get("id", ""), "status": "fixed",
                    "message": "Vulnerability no longer reproducible"}
        else:
            return {"finding_id": finding.get("id", ""), "status": "still_open",
                    "message": "Vulnerability still reproducible"}
    except Exception as e:
        return {"finding_id": finding.get("id", ""), "status": "retest_error",
                "message": str(e)}


async def retest_all(
    findings: list[dict],
    scan_id: str,
    concurrency: int = 5,
) -> list[dict]:
    """Retest all confirmed findings. Returns list of results."""
    semaphore = asyncio.Semaphore(concurrency)

    async def _retest_one(finding: dict) -> dict:
        async with semaphore:
            async with GuardedClient(scan_id=scan_id, timeout=15.0, follow_redirects=True, verify=False) as client:
                return await retest_finding(finding, client)

    tasks = [_retest_one(f) for f in findings]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    parsed = []
    for r in results:
        if isinstance(r, Exception):
            parsed.append({"finding_id": "", "status": "retest_error", "message": str(r)})
        else:
            parsed.append(r)

    # Update DB
    _save_retest_results(parsed)

    return parsed


def _save_retest_results(results: list[dict]) -> None:
    """Update finding status in DB based on retest results."""
    try:
        conn = get_db()
        with conn:
            for r in results:
                fid = r.get("finding_id", "")
                status = r.get("status", "")
                if fid and status:
                    conn.execute(
                        "UPDATE findings SET status = ? WHERE id = ?",
                        (status, fid)
                    )
        conn.close()
    except Exception:
        pass


def get_retest_targets(scan_id: str) -> list[dict]:
    """Load confirmed findings from DB for retesting."""
    try:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute(
            "SELECT * FROM findings WHERE scan_id = ? AND status = 'confirmed'",
            (scan_id,)
        )
        rows = cursor.fetchall()
        conn.close()
        return [dict(r) for r in rows]
    except Exception:
        return []