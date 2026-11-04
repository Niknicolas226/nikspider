import pytest
from httpx import AsyncClient, ASGITransport
from nikspider.backend.server import app
from nikspider.common.db import get_db
import json

@pytest.mark.asyncio
async def test_get_finding_debate_not_found():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.get("/api/v2/findings/non-existent-finding-id/debate")
        assert res.status_code == 404

@pytest.mark.asyncio
async def test_get_finding_debate_success():
    conn = get_db()
    finding_id = "test-finding-deb-123"
    scan_id = "test-scan-deb-456"

    with conn:
        conn.execute("INSERT OR REPLACE INTO targets (id, url, token) VALUES (?, ?, ?)", ("t-1", "http://localhost:5000", "tok"))
        conn.execute("INSERT OR REPLACE INTO scans (id, target_id, started_at) VALUES (?, ?, ?)", (scan_id, "t-1", "2026-01-01"))
        conn.execute(
            """INSERT OR REPLACE INTO findings (id, scan_id, module, url, param, request, response, signal, extra)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                finding_id,
                scan_id,
                "sqli",
                "http://localhost:5000/search",
                "q",
                "GET /search?q='",
                "SQL syntax error",
                "leak",
                json.dumps({
                    "reasoning": {
                        "argumenter": "Agent A argued that SQL injection is fully reproducible.",
                        "opposer": "Agent B argued that queries might be parameterized in prod.",
                        "verdict": "confirmed",
                        "severity": "Critical",
                        "confidence": 0.96,
                        "reason": "Deterministic single quote provoke leak",
                        "rule_check": "PASS",
                        "pros": ["Direct syntax error reflected in response"],
                        "cons": ["No second order extraction proven"],
                    }
                })
            )
        )
        conn.execute(
            """INSERT OR REPLACE INTO triage (finding_id, agent_a, agent_b, verdict, severity, owasp, confidence, reason, evidence_quote, source)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                finding_id,
                "Agent A argued that SQL injection is fully reproducible.",
                "Agent B argued that queries might be parameterized in prod.",
                "confirmed",
                "Critical",
                "A03:2021-Injection",
                0.96,
                "Deterministic single quote provoke leak",
                "SQL syntax error",
                "llm",
            )
        )
    conn.close()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.get(f"/api/v2/findings/{finding_id}/debate")
        assert res.status_code == 200
        data = res.json()
        assert data["finding_id"] == finding_id
        assert "Agent A" in data["prosecutor"]
        assert "Agent B" in data["defender"]
        assert data["judge"]["verdict"] == "confirmed"
        assert data["judge"]["severity"] == "Critical"
        assert data["judge"]["confidence"] == 0.96
        assert len(data["pros"]) == 1
        assert len(data["cons"]) == 1
        assert data["evidence"]["signal"] == "leak"
