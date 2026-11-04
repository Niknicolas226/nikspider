"""Dedup engine — fingerprint-based deduplication across scan runs.

Uses module + URL template + param hash for same-run and cross-run dedup.
"""

import hashlib
import re
from datetime import datetime, timezone
from typing import Any

try:
    from nikspider.common.models import Finding
    from nikspider.common.db import get_db
except ImportError:
    from backend.db import get_db


def url_template(url: str) -> str:
    """Replace numeric IDs and UUIDs with placeholders for dedup."""
    tpl = re.sub(r"/\d+(?=/|$)", "/{id}", url)
    tpl = re.sub(r"/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}", "/{uuid}", tpl, flags=re.I)
    return tpl


def fingerprint(finding: Finding | dict) -> str:
    """Generate a stable dedup fingerprint."""
    if isinstance(finding, Finding):
        module = finding.module
        url = url_template(finding.url)
        param = finding.param
    else:
        module = finding.get("module", "")
        url = url_template(finding.get("url", ""))
        param = finding.get("param", "")

    raw = f"{module}|{url}|{param}"
    return hashlib.sha256(raw.encode()).hexdigest()[:16]


def is_duplicate(finding: Finding | dict, existing_fingerprints: set[str]) -> bool:
    """Check if a finding's fingerprint already exists in the set."""
    return fingerprint(finding) in existing_fingerprints


def save_dedup_record(finding: Finding) -> None:
    """Save a fingerprint record to the database."""
    try:
        conn = get_db()
        with conn:
            fp = fingerprint(finding)
            conn.execute(
                """INSERT OR IGNORE INTO findings_history
                   (dedup_key, module, url_template, param, first_seen, last_seen, state, severity)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                (fp, finding.module, url_template(finding.url), finding.param,
                 datetime.now(timezone.utc).isoformat(),
                 datetime.now(timezone.utc).isoformat(),
                 finding.status, "unknown")
            )
        conn.close()
    except Exception:
        pass


def load_dedup_set(scan_id: str) -> set[str]:
    """Load all fingerprints from a scan for dedup."""
    try:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("SELECT dedup_key FROM findings WHERE scan_id = ? AND dedup_key IS NOT NULL", (scan_id,))
        rows = cursor.fetchall()
        conn.close()
        return {r["dedup_key"] for r in rows if r["dedup_key"]}
    except Exception:
        return set()