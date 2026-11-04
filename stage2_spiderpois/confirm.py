"""Confirm — signal dedup and evidence collection.

After probes produce raw findings, this stage:
  1. Generates dedup keys
  2. Checks findings_history for known/closed vulnerabilities
  3. Marks finding status: "new", "known", "duplicate", "confirmed"
"""

import hashlib
import json
import os
from datetime import datetime, timezone
from typing import Any

try:
    from nikspider.common.models import Finding
    from nikspider.common.db import get_db
except ImportError:
    from backend.db import get_db


def make_dedup_key(finding: Finding | dict) -> str:
    """Generate a stable dedup key from module + URL template + param."""
    if isinstance(finding, Finding):
        mod = finding.module
        url = finding.url
        param = finding.param
    else:
        mod = finding.get("module", "")
        url = finding.get("url", "")
        param = finding.get("param", "")

    # Template the URL: strip numeric IDs
    import re
    url_template = re.sub(r"/\d+(/|$)", "/{id}\\1", url)

    raw = f"{mod}|{url_template}|{param}"
    return hashlib.sha256(raw.encode()).hexdigest()[:16]


def lookup_history(dedup_key: str) -> dict | None:
    """Check findings_history for a known finding."""
    try:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute(
            "SELECT dedup_key, module, url_template, param, first_seen, last_seen, state, severity FROM findings_history WHERE dedup_key = ?",
            (dedup_key,)
        )
        row = cursor.fetchone()
        conn.close()
        if row:
            return dict(row)
    except Exception:
        pass
    return None


def confirm(finding: Finding, store_to_db: bool = True) -> str:
    """Confirm a raw finding: dedup, check history, update status.

    Returns the new status: "new", "known", "duplicate", or "confirmed".
    """
    dedup_key = make_dedup_key(finding)
    finding.dedup_key = dedup_key

    if store_to_db:
        history = lookup_history(dedup_key)
        if history:
            state = history.get("state", "raw")
            if state in ("closed", "fixed", "wontfix"):
                finding.status = "known"
                return "known"
            finding.status = "duplicate"
            return "duplicate"

    finding.status = "confirmed"
    try:
        from api.websocket import emit_event_sync
        scan_id = getattr(finding, "scan_id", "") if isinstance(finding, Finding) else finding.get("scan_id", "")
        mod = finding.module if isinstance(finding, Finding) else finding.get("module", "")
        url = finding.url if isinstance(finding, Finding) else finding.get("url", "")
        sig = finding.signal if isinstance(finding, Finding) else finding.get("signal", "")
        emit_event_sync(
            scan_id=scan_id,
            stage="2",
            event_type="signal",
            module=mod,
            endpoint=url,
            severity="medium",
            message=f"⚠ Signal: {mod.upper()} {sig[:80] if sig else 'differential detected'} (medium confidence)",
        )
    except Exception:
        pass
    return "confirmed"


def save_to_history(finding: Finding) -> None:
    """Save a confirmed finding to the findings_history table."""
    try:
        conn = get_db()
        with conn:
            import re
            url_template = re.sub(r"/\d+(/|$)", "/{id}\\1", finding.url)
            conn.execute(
                """INSERT OR REPLACE INTO findings_history
                   (dedup_key, module, url_template, param, first_seen, last_seen, state, severity)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    finding.dedup_key or make_dedup_key(finding),
                    finding.module,
                    url_template,
                    finding.param,
                    datetime.now(timezone.utc).isoformat(),
                    datetime.now(timezone.utc).isoformat(),
                    "raw",
                    "unknown",
                )
            )
        conn.close()
    except Exception:
        pass