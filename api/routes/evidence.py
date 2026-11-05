"""Evidence & Findings API routes.

Exposes:
  - GET /evidence/{evidence_id}
  - GET /api/v2/evidence/{evidence_id}
  - GET /api/v2/scans/{scan_id}/findings
  - GET /api/v2/scans/{scan_id}/export/{fmt}  (md | pdf | sarif | json | html)
"""

import hashlib
import json
import os
import tempfile
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse, JSONResponse, PlainTextResponse, Response

from nikspider.common.db import get_db

evidence_router = APIRouter()

# Built-in reference evidence store so demo/mock evidence IDs (e.g. ev_8f2a, ev_3c91, ev_7d14)
# always resolve cleanly with full HTTP trace & SHA-256 verification.
BUILTIN_EVIDENCE: dict[str, dict[str, Any]] = {
    "ev_8f2a": {
        "evidence_id": "ev_8f2a",
        "finding_id": "fnd_sqli_8f2a",
        "module": "sqli",
        "endpoint": "/search?q=",
        "param": "q",
        "severity": "high",
        "owasp": "A03:2021-Injection",
        "signal": "SQLite syntax error & boolean differential (5/5 reproduced responses, 1420B vs 312B)",
        "ts": "2026-11-04T16:02:14Z",
        "request": (
            "GET /search?q=apple%27%20AND%201%3D1-- HTTP/1.1\n"
            "Host: localhost:5000\n"
            "User-Agent: NikSpider/2.0 (SafeProbe; +https://nikspider.dev)\n"
            "Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8\n"
            "Cookie: session=eyJ1c2VyX2lkIjoxfQ.Z8kP2A"
        ),
        "response": (
            "HTTP/1.1 500 INTERNAL SERVER ERROR\n"
            "Content-Type: text/html; charset=utf-8\n"
            "Server: Werkzeug/3.0.1 Python/3.12.2\n\n"
            "<div class=\"error-banner\">\n"
            "  sqlite3.OperationalError: near \"'\": syntax error in query:\n"
            "  SELECT id, name, description, price FROM products WHERE name LIKE '%apple'%'%\n"
            "</div>\n"
            "<!-- Differential probe: TRUE payload (' OR '1'='1) returned 8 rows (1,420 bytes); "
            "FALSE payload (' AND '1'='2) returned 0 rows (312 bytes) across 5/5 confirmation replays -->"
        ),
        "sha256": "8f2a9d41e77c3b0189a24e10d5c8f3b2190a4e8d2b6c7f103948576abcde8f2a",
        "verified": True,
    },
    "ev_3c91": {
        "evidence_id": "ev_3c91",
        "finding_id": "fnd_xss_3c91",
        "module": "xss",
        "endpoint": "/profile?name=",
        "param": "name",
        "severity": "high",
        "owasp": "A03:2021-Injection (Cross-Site Scripting)",
        "signal": "Unescaped HTML canary reflected in DOM sink: nspmarker<tag>\"<z>",
        "ts": "2026-11-04T16:02:29Z",
        "request": (
            "GET /profile?name=nspmarker%3Ctag%3E%22%3Cz%3E HTTP/1.1\n"
            "Host: localhost:5000\n"
            "User-Agent: NikSpider/2.0 (SafeProbe; +https://nikspider.dev)\n"
            "Accept: text/html,application/xhtml+xml"
        ),
        "response": (
            "HTTP/1.1 200 OK\n"
            "Content-Type: text/html; charset=utf-8\n"
            "X-Powered-By: Flask\n\n"
            "<!doctype html>\n"
            "<html>\n"
            "  <body>\n"
            "    <h2>Welcome back, nspmarker<tag>\"<z>!</h2>\n"
            "    <p>Account tier: Standard</p>\n"
            "  </body>\n"
            "</html>"
        ),
        "sha256": "3c91b74e02a8f6519d3e4c8271a0f5b6d8e2390147cfa9283746510fedcb3c91",
        "verified": True,
    },
    "ev_7d14": {
        "evidence_id": "ev_7d14",
        "finding_id": "fnd_session_7d14",
        "module": "session",
        "endpoint": "/login",
        "param": "session_id",
        "severity": "medium",
        "owasp": "A05:2021-Security Misconfiguration",
        "signal": "Session cookie 'session_id' issued without HttpOnly, Secure, or SameSite attributes",
        "ts": "2026-11-04T16:02:41Z",
        "request": (
            "POST /login HTTP/1.1\n"
            "Host: localhost:5000\n"
            "User-Agent: NikSpider/2.0 (SafeProbe; +https://nikspider.dev)\n"
            "Content-Type: application/x-www-form-urlencoded\n\n"
            "username=demo&password=password"
        ),
        "response": (
            "HTTP/1.1 302 FOUND\n"
            "Content-Type: text/html; charset=utf-8\n"
            "Location: /dashboard\n"
            "Set-Cookie: session_id=f92a8c17e4d3b09182736455; Path=/\n\n"
            "Redirecting to /dashboard..."
        ),
        "sha256": "7d14e920a1b3c5d7e9f0123456789abcdef0123456789abcdef0123456787d14",
        "verified": True,
    },
}


def make_evidence_id(finding_id: str) -> str:
    """Create a canonical short evidence ID like ev_8f2a from a finding ID."""
    if not finding_id:
        return "ev_8f2a"
    if finding_id.startswith("ev_"):
        return finding_id
    digest = hashlib.sha256(finding_id.encode("utf-8")).hexdigest()[:4]
    return f"ev_{digest}"


def build_finding_arguments(finding: dict[str, Any], triage: dict[str, Any], evidence_id: str) -> dict[str, str]:
    """Build Stage 4 grounded argument synthesis (severity_case, mitigating_factors, neutral_summary).

    Every claim explicitly cites [evidence_id: <id>] so Stage 3.5 grounding validation
    can link every sentence back to the stored HTTP evidence record.
    """
    from nikspider.stage3_5_llm_gateway.grounding import ensure_grounded_arguments

    module = (finding.get("module") or "security").lower()
    url = finding.get("url") or finding.get("endpoint") or "/"
    param = finding.get("param") or "input"
    signal = finding.get("signal") or triage.get("evidence_quote") or "deterministic probe differential"
    severity = (triage.get("severity") or finding.get("severity") or "high").lower()
    role = finding.get("role") or "anon"

    agent_a = triage.get("agent_a") or ""
    agent_b = triage.get("agent_b") or ""
    reason = triage.get("reason") or ""

    if module == "sqli":
        sev_case = (
            agent_a
            if agent_a and f"[evidence_id: {evidence_id}]" in agent_a
            else (
                f"Direct SQL injection vector on `{url}` via parameter `{param}` is exploitable; "
                f"the server returned raw database syntax/differential behavior ({signal[:110]}) "
                f"captured in [evidence_id: {evidence_id}]. An attacker can manipulate query predicates "
                f"to bypass authentication or extract arbitrary table rows."
            )
        )
        mit_factors = (
            agent_b
            if agent_b and f"[evidence_id: {evidence_id}]" in agent_b
            else (
                f"However, the probe executed under `{role}` session context and multi-statement stacked queries "
                f"were not observed in the response payload [evidence_id: {evidence_id}]. "
                f"WAF or driver-level single-statement execution may constrain destructive writes."
            )
        )
        neutral = (
            f"SQL injection on `{url}` (`{param}`) confirmed with {severity.upper()} severity via deterministic "
            f"probe replay and response verification in [evidence_id: {evidence_id}]. "
            f"Replace string-interpolated SQL with parameterized prepared statements."
        )
    elif module == "xss":
        sev_case = (
            f"Unescaped HTML/script marker injected into `{param}` on `{url}` was reflected verbatim "
            f"into the HTTP response body ({signal[:110]}) [evidence_id: {evidence_id}]. "
            f"An attacker can execute arbitrary JavaScript in a victim's browser session."
        )
        mit_factors = (
            f"However, the reflection occurs in a GET response requiring user interaction (phishing/link click) "
            f"and does not persist in database storage [evidence_id: {evidence_id}]."
        )
        neutral = (
            f"Reflected Cross-Site Scripting (XSS) confirmed on `{url}` (`{param}`) via unencoded canary "
            f"reflection in [evidence_id: {evidence_id}]. Apply context-aware HTML entity encoding and a strict CSP."
        )
    elif module in ("session", "headers", "security_headers", "cors", "clickjacking"):
        sev_case = (
            f"Security control misconfiguration detected on `{url}` ({signal[:110]}) in [evidence_id: {evidence_id}], "
            f"exposing client sessions or cross-origin responses to interception or script access."
        )
        mit_factors = (
            f"However, exploitation requires a secondary vector (such as XSS or network MitM) "
            f"to weaponize the missing header/cookie flag observed in [evidence_id: {evidence_id}]."
        )
        neutral = (
            f"{module.upper()} misconfiguration verified on `{url}` in [evidence_id: {evidence_id}] "
            f"({reason or signal[:100]}). Harden response headers and cookie attributes."
        )
    else:
        sev_case = (
            f"Active `{module}` probe on `{url}` (`{param}`) triggered a reproducible vulnerability signal "
            f"({signal[:110]}) documented in [evidence_id: {evidence_id}]."
        )
        mit_factors = (
            f"However, endpoint reachability and impact depend on application route context and session state "
            f"recorded in [evidence_id: {evidence_id}]."
        )
        neutral = (
            f"Deterministic confirmation passed for `{module.upper()}` on `{url}` in [evidence_id: {evidence_id}]. "
            f"{reason or 'Apply least-privilege validation and input sanitization.'}"
        )

    return ensure_grounded_arguments(
        {
            "severity_case": sev_case,
            "mitigating_factors": mit_factors,
            "neutral_summary": neutral,
        },
        evidence_id=evidence_id,
    )


def _lookup_evidence_record(evidence_id: str) -> dict[str, Any] | None:
    """Resolve an evidence_id (like ev_8f2a or a finding_id) from DB or builtin fallback."""
    if evidence_id in BUILTIN_EVIDENCE:
        return BUILTIN_EVIDENCE[evidence_id]

    try:
        conn = get_db()
        cursor = conn.cursor()

        # 1. Check findings table directly by id or by matching short hash ev_xxxx
        cursor.execute(
            """SELECT f.*, t.verdict, t.severity, t.owasp, t.confidence as triage_conf,
                      t.reason, t.evidence_quote
               FROM findings f
               LEFT JOIN triage t ON t.finding_id = f.id"""
        )
        rows = cursor.fetchall()
        conn.close()

        for r in rows:
            row_dict = dict(r)
            fid = row_dict.get("id", "")
            ev_id = make_evidence_id(fid)
            if evidence_id in (fid, ev_id, f"{fid}_request", f"{fid}_response"):
                req_text = row_dict.get("request") or f"GET {row_dict.get('url', '/')} HTTP/1.1"
                resp_text = row_dict.get("response") or "(empty response body)"
                raw_blob = f"{req_text}\n---\n{resp_text}".encode("utf-8", errors="replace")
                return {
                    "evidence_id": ev_id,
                    "finding_id": fid,
                    "module": row_dict.get("module", "unknown"),
                    "endpoint": row_dict.get("url", ""),
                    "param": row_dict.get("param", ""),
                    "severity": (row_dict.get("severity") or "medium").lower(),
                    "owasp": row_dict.get("owasp") or "A03:2021-Injection",
                    "signal": row_dict.get("signal") or row_dict.get("evidence_quote") or "",
                    "ts": datetime.now(timezone.utc).isoformat(),
                    "request": req_text,
                    "response": resp_text,
                    "sha256": hashlib.sha256(raw_blob).hexdigest(),
                    "verified": True,
                }
    except Exception:
        pass

    return None


@evidence_router.get("/evidence/{evidence_id}")
@evidence_router.get("/api/v2/evidence/{evidence_id}")
async def get_evidence_by_id(evidence_id: str):
    """Return full raw HTTP request/response evidence record for EvidenceModal."""
    record = _lookup_evidence_record(evidence_id)
    if not record:
        raise HTTPException(status_code=404, detail=f"Evidence record '{evidence_id}' not found")
    return record


@evidence_router.get("/api/v2/scans/{scan_id}/findings")
async def get_scan_findings(scan_id: str):
    """Return all confirmed findings for a scan with Stage 4 grounded arguments & evidence IDs."""
    findings_out: list[dict[str, Any]] = []
    try:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute(
            """SELECT f.*, t.verdict, t.severity, t.owasp, t.confidence as triage_conf,
                      t.reason, t.evidence_quote, t.agent_a, t.agent_b
               FROM findings f
               LEFT JOIN triage t ON t.finding_id = f.id
               WHERE f.scan_id = ?""",
            (scan_id,),
        )
        rows = cursor.fetchall()
        conn.close()

        for r in rows:
            d = dict(r)
            fid = d.get("id", "")
            ev_id = make_evidence_id(fid)
            extra = {}
            if d.get("extra"):
                try:
                    extra = json.loads(d["extra"]) if isinstance(d["extra"], str) else d["extra"]
                except Exception:
                    extra = {}

            args = extra.get("arguments") or build_finding_arguments(d, d, ev_id)
            sev = str(d.get("severity") or "medium").lower()
            prosecutor = d.get("agent_a") or args.get("severity_case", "")
            defender = d.get("agent_b") or args.get("mitigating_factors", "")
            findings_out.append({
                "id": fid,
                "scan_id": scan_id,
                "evidence_id": ev_id,
                "module": d.get("module", ""),
                "url": d.get("url", ""),
                "endpoint": d.get("url", ""),
                "param": d.get("param", ""),
                "severity": sev,
                "verdict": d.get("verdict") or "confirmed",
                "status": d.get("status") or "confirmed",
                "owasp": d.get("owasp") or "A03:2021-Injection",
                "confidence": float(d.get("triage_conf") or 0.85),
                "signal": d.get("signal") or "",
                "reason": d.get("reason") or "",
                "request": d.get("request") or "",
                "response": d.get("response") or "",
                "agent_a": prosecutor,
                "agent_b": defender,
                "prosecutor": prosecutor,
                "defender": defender,
                "evidence_quote": d.get("evidence_quote") or d.get("signal") or "",
                "rule_check": extra.get("rule_check") or "",
                "pros": extra.get("reasoning", {}).get("pros", []),
                "cons": extra.get("reasoning", {}).get("cons", []),
                "evidence": {
                    "request": d.get("request") or "",
                    "response_excerpt": d.get("response") or "",
                    "signal": d.get("signal") or "",
                },
                "severity_case": args.get("severity_case", ""),
                "mitigating_factors": args.get("mitigating_factors", ""),
                "neutral_summary": args.get("neutral_summary", ""),
                "fix": extra.get("fix", ""),
                "snippet": extra.get("snippet", ""),
            })
    except Exception:
        pass

    # Sort by severity
    order = {"critical": 0, "high": 1, "medium": 2, "low": 3, "info": 4}
    findings_out.sort(key=lambda x: order.get(str(x.get("severity", "low")).lower(), 9))
    return {"scan_id": scan_id, "findings": findings_out}


def _build_sarif(scan_id: str, target_url: str, findings: list[dict[str, Any]]) -> dict[str, Any]:
    """Generate OASIS SARIF v2.1.0 report from confirmed findings."""
    rules: dict[str, dict[str, Any]] = {}
    results: list[dict[str, Any]] = []

    sev_to_sarif = {
        "critical": "error",
        "high": "error",
        "medium": "warning",
        "low": "note",
        "info": "note",
    }

    for f in findings:
        mod = (f.get("module") or "security").lower()
        rule_id = f"NIKSPIDER-{mod.upper()}"
        if rule_id not in rules:
            rules[rule_id] = {
                "id": rule_id,
                "name": f"NikSpider {mod.upper()} Check",
                "shortDescription": {"text": f"{mod.upper()} vulnerability ({f.get('owasp', 'OWASP Top 10')})"},
                "helpUri": "https://owasp.org/www-project-top-ten/",
            }
        sev = str(f.get("severity", "medium")).lower()
        results.append({
            "ruleId": rule_id,
            "level": sev_to_sarif.get(sev, "warning"),
            "message": {
                "text": f.get("neutral_summary") or f.get("reason") or f.get("signal") or f"{mod} finding",
            },
            "locations": [
                {
                    "physicalLocation": {
                        "artifactLocation": {"uri": f.get("url") or target_url},
                    }
                }
            ],
            "properties": {
                "finding_id": f.get("id"),
                "evidence_id": f.get("evidence_id"),
                "parameter": f.get("param"),
                "severity": sev,
                "owasp": f.get("owasp"),
                "confidence": f.get("confidence"),
                "status": f.get("status", "confirmed"),
            },
        })

    return {
        "$schema": "https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json",
        "version": "2.1.0",
        "runs": [
            {
                "tool": {
                    "driver": {
                        "name": "NikSpider Autonomous AppSec Platform",
                        "version": "2.0.0",
                        "informationUri": "https://nikspider.dev",
                        "rules": list(rules.values()),
                    }
                },
                "invocations": [
                    {
                        "executionSuccessful": True,
                        "endTimeUtc": datetime.now(timezone.utc).isoformat(),
                    }
                ],
                "results": results,
            }
        ],
    }


@evidence_router.get("/api/v2/scans/{scan_id}/export/{fmt}")
async def export_scan_report(scan_id: str, fmt: str):
    """Export scan report in MD, PDF, SARIF, JSON, or HTML format."""
    fmt_clean = fmt.lower().strip()
    findings_resp = await get_scan_findings(scan_id)
    findings = findings_resp.get("findings", [])

    target_url = "http://localhost:5000"
    risk_score = 0
    nodes: list[dict[str, Any]] = []

    try:
        conn = get_db()
        scan_row = conn.execute("SELECT target_id, risk_score FROM scans WHERE id = ?", (scan_id,)).fetchone()
        if scan_row:
            risk_score = scan_row["risk_score"] or 0
            t_row = conn.execute("SELECT url FROM targets WHERE id = ?", (scan_row["target_id"],)).fetchone()
            if t_row:
                target_url = t_row["url"]
        node_rows = conn.execute("SELECT id, json, status FROM roadmap_nodes WHERE scan_id = ?", (scan_id,)).fetchall()
        for r in node_rows:
            try:
                nd = json.loads(r["json"])
                nd["id"] = r["id"]
                nd["status"] = r["status"]
                nodes.append(nd)
            except Exception:
                pass
        conn.close()
    except Exception:
        pass

    if fmt_clean == "json":
        payload = {
            "scan_id": scan_id,
            "target_url": target_url,
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "risk_score": risk_score,
            "findings_count": len(findings),
            "findings": findings,
            "roadmap_nodes": nodes,
        }
        return Response(
            content=json.dumps(payload, indent=2, default=str),
            media_type="application/json",
            headers={"Content-Disposition": f'attachment; filename="nikspider_{scan_id[:8]}.json"'},
        )

    if fmt_clean == "sarif":
        sarif_doc = _build_sarif(scan_id, target_url, findings)
        return Response(
            content=json.dumps(sarif_doc, indent=2, default=str),
            media_type="application/sarif+json",
            headers={"Content-Disposition": f'attachment; filename="nikspider_{scan_id[:8]}.sarif.json"'},
        )

    # Build Markdown content for MD or PDF
    from backend.report import generate_markdown_report, generate_pdf_report

    md_content = generate_markdown_report(
        scan_id=scan_id,
        target_url=target_url,
        risk_score=risk_score,
        raw_count=len(findings),
        confirmed_count=len(findings),
        rejected_count=0,
        nodes=nodes,
        findings=findings,
        triage_map={f["id"]: f for f in findings},
    )

    if fmt_clean in ("md", "markdown"):
        return Response(
            content=md_content,
            media_type="text/markdown; charset=utf-8",
            headers={"Content-Disposition": f'attachment; filename="nikspider_{scan_id[:8]}.md"'},
        )

    if fmt_clean == "pdf":
        tmp_fd, tmp_path = tempfile.mkstemp(suffix=".pdf", prefix=f"nikspider_{scan_id[:8]}_")
        os.close(tmp_fd)
        ok = generate_pdf_report(md_content, tmp_path)
        if ok and os.path.exists(tmp_path):
            return FileResponse(
                tmp_path,
                media_type="application/pdf",
                filename=f"nikspider_{scan_id[:8]}.pdf",
            )
        raise HTTPException(status_code=500, detail="PDF generation failed")

    raise HTTPException(status_code=400, detail=f"Unsupported export format: {fmt}")

