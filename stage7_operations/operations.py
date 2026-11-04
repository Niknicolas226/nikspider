"""Operations stubs — recurring scan, alerting, database cleanup.

These are placeholder implementations for Stage 7 operational readiness.
"""

import asyncio
import os
from datetime import datetime, timezone
from typing import Any


async def schedule_scan(
    target_url: str,
    profile: str = "standard",
    cron_expression: str = "0 0 * * 0",  # Default: weekly Sunday midnight
) -> str:
    """Schedule a recurring scan. Placeholder — real impl would use APScheduler or Celery."""
    # Placeholder: just returns an ID
    import uuid
    job_id = str(uuid.uuid4())
    return job_id


async def check_alert_thresholds(
    results: dict,
    max_critical: int = 1,
    max_high: int = 5,
) -> list[str]:
    """Check if scan results exceed alert thresholds. Returns list of alert messages."""
    alerts = []
    rs = results.get("risk_summary", {})
    severity_counts = rs.get("severity_counts", {})

    if severity_counts.get("critical", 0) > max_critical:
        alerts.append(f"CRITICAL: {severity_counts['critical']} critical findings exceed threshold of {max_critical}")

    if severity_counts.get("high", 0) > max_high:
        alerts.append(f"HIGH: {severity_counts['high']} high findings exceed threshold of {max_high}")

    return alerts


async def cleanup_old_scans(max_age_days: int = 90) -> int:
    """Remove scans older than max_age_days from the database. Returns count removed."""
    try:
        from nikspider.common.db import get_db
        conn = get_db()
        cursor = conn.cursor()
        cutoff = datetime.now(timezone.utc).isoformat()
        cursor.execute("SELECT id FROM scans WHERE started_at < ?", (cutoff.replace("T", " ")[:10],))
        old_ids = [r[0] for r in cursor.fetchall()]
        with conn:
            for scan_id in old_ids:
                conn.execute("DELETE FROM findings WHERE scan_id = ?", (scan_id,))
                conn.execute("DELETE FROM roadmap_nodes WHERE scan_id = ?", (scan_id,))
                conn.execute("DELETE FROM request_log WHERE scan_id = ?", (scan_id,))
                conn.execute("DELETE FROM scans WHERE id = ?", (scan_id,))
        conn.close()
        return len(old_ids)
    except Exception:
        return 0