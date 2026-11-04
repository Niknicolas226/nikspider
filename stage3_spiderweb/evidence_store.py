"""Evidence store — request/response pairs, diff evidence, screenshots.

Stored as keyed blobs in SQLite for retrieval during report generation.
"""

import json
import os
from datetime import datetime, timezone
from typing import Any

try:
    from nikspider.common.db import get_db
except ImportError:
    from backend.db import get_db

EVIDENCE_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "evidence_store")
os.makedirs(EVIDENCE_DIR, exist_ok=True)


def store_evidence(finding_id: str, kind: str, data: str | dict | bytes) -> str:
    """Store evidence as a file in the evidence_store directory and DB reference."""
    if isinstance(data, dict):
        data = json.dumps(data, indent=2)
    if isinstance(data, bytes):
        data = data.decode("latin-1", errors="replace")

    ts = datetime.now(timezone.utc).isoformat().replace(":", "-")
    filename = f"{kind}_{finding_id[:8]}_{ts}"
    filepath = os.path.join(EVIDENCE_DIR, filename)

    with open(filepath, "w", encoding="utf-8") as f:
        f.write(data if isinstance(data, str) else str(data))

    try:
        conn = get_db()
        with conn:
            conn.execute(
                "INSERT OR REPLACE INTO evidence (id, finding_id, kind, blob, ts) VALUES (?, ?, ?, ?, ?)",
                (f"{finding_id}_{kind}", finding_id, kind, filepath, datetime.now(timezone.utc).isoformat())
            )
        conn.close()
    except Exception:
        pass

    return filepath


def get_evidence(finding_id: str, kind: str | None = None) -> list[dict]:
    """Retrieve evidence records for a finding."""
    try:
        conn = get_db()
        cursor = conn.cursor()
        if kind:
            cursor.execute("SELECT * FROM evidence WHERE finding_id = ? AND kind = ?", (finding_id, kind))
        else:
            cursor.execute("SELECT * FROM evidence WHERE finding_id = ?", (finding_id,))
        rows = cursor.fetchall()
        conn.close()
        return [dict(r) for r in rows]
    except Exception:
        return []


def store_req_resp(finding_id: str, request_text: str, response_text: str) -> None:
    """Store request and response as evidence."""
    store_evidence(finding_id, "request", request_text)
    store_evidence(finding_id, "response", response_text[:3000])