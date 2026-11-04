"""NikSpider API routes — staged architecture entry points.

New staged API mounted under /api/v2, delegating to the orchestrator and
the staged modules. The legacy backend/main.py remains for backward compat.
"""

import asyncio
import json
import os
import uuid
from datetime import datetime, timezone
from typing import Any
from urllib.parse import urlparse

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse, PlainTextResponse
from pydantic import BaseModel

from nikspider.orchestrator import Orchestrator
from nikspider.stage0_intake_guard.verify import new_token
from nikspider.common.db import get_db
from nikspider.stage0_intake_guard.verify import verify_file
from nikspider.stage0_intake_guard.guard import GuardedClient
from nikspider.stage6_close_the_loop.retest import retest_finding

router = APIRouter(prefix="/api/v2")

# Singleton orchestrator shared across requests
_orchestrator: Orchestrator | None = None
_targets: dict[str, dict[str, Any]] = {}


def get_orchestrator() -> Orchestrator:
    global _orchestrator
    if _orchestrator is None:
        llm_enabled = bool(os.getenv("LLM_API_KEY") or os.getenv("META_API_KEY") or os.getenv("OPENAI_API_KEY"))
        _orchestrator = Orchestrator(
            demo_mode=os.getenv("DEMO_MODE", "0") in ("1", "true", "yes"),
            llm_enabled=llm_enabled,
        )
    return _orchestrator


class VerifyRequest(BaseModel):
    url: str
    token: str = ""


class ScanRequest(BaseModel):
    url: str
    token: str = ""
    profile: str = "standard"
    modules: list[str] | None = None
    max_pages: int = 200
    max_depth: int = 3
    seed_endpoints: list[str] | None = None
    credentials: dict | None = None


@router.get("/health")
async def health():
    demo_mode = os.getenv("DEMO_MODE", "0").lower() in ("1", "true", "yes")
    return {
        "status": "ok",
        "service": "nikspider-api-v2",
        "demo_mode": demo_mode,
        "time": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/targets/{target_id}/history")
async def get_target_history(target_id: str):
    target = _targets.get(target_id)
    target_url = target["url"] if target else None
    conn = get_db()
    try:
        if target_url:
            rows = conn.execute(
                """SELECT s.id, s.risk_score, s.raw_count, s.confirmed_count, s.started_at
                   FROM scans s
                   JOIN targets t ON s.target_id = t.id
                   WHERE t.url = ?
                   ORDER BY s.started_at ASC LIMIT 20""",
                (target_url,),
            ).fetchall()
        else:
            rows = conn.execute(
                """SELECT id, risk_score, raw_count, confirmed_count, started_at
                   FROM scans WHERE target_id = ?
                   ORDER BY started_at ASC LIMIT 20""",
                (target_id[:8],),
            ).fetchall()
        return {"history": [dict(r) for r in rows]}
    except Exception:
        return {"history": []}
    finally:
        conn.close()


@router.post("/verify-ownership")
async def verify_ownership(req: VerifyRequest):
    hostname = (urlparse(req.url).hostname or "").lower()
    demo_mode = os.getenv("DEMO_MODE", "0").lower() in ("1", "true", "yes")
    if demo_mode and hostname in {"localhost", "127.0.0.1", "::1", "demo-app"}:
        token = os.getenv("NIKSPIDER_TOKEN", "nikspider-verify=demo_token_12345678")
        try:
            root_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
            with open(os.path.join(root_dir, ".nikspider-token"), "w", encoding="utf-8") as f:
                f.write(token)
        except Exception:
            pass
    else:
        token = new_token()
    target_id = str(uuid.uuid4())
    file_url = f"{req.url.rstrip('/')}/.well-known/nikspider.txt"
    _targets[target_id] = {"url": req.url.rstrip("/"), "token": token, "verified": False}
    return {
        "id": target_id,
        "url": req.url.rstrip("/"),
        "token": token,
        "file": file_url,
        "instructions": "Place the token at this path, then verify ownership.",
    }


@router.post("/verify-token")
async def verify_token(req: VerifyRequest, token: str = ""):
    supplied_token = req.token or token
    async with GuardedClient(timeout=10.0, follow_redirects=True) as client:
        verified = await verify_file(req.url, supplied_token, client)
    for target in _targets.values():
        if target["url"] == req.url.rstrip("/") and target["token"] == supplied_token:
            target["verified"] = verified
    return {"verified": verified}


@router.post("/targets")
async def create_target(req: VerifyRequest):
    """Compatibility endpoint used by the existing React dashboard."""
    return await verify_ownership(req)


@router.post("/targets/{target_id}/verify")
async def verify_target(target_id: str):
    target = _targets.get(target_id)
    if not target:
        raise HTTPException(status_code=404, detail="Target not found; register it again")
    async with GuardedClient(timeout=10.0, follow_redirects=True) as client:
        target["verified"] = await verify_file(target["url"], target["token"], client)
    return {"verified": target["verified"]}


@router.post("/pipeline/scans")
async def start_scan(req: ScanRequest):
    async with GuardedClient(timeout=10.0, follow_redirects=True) as client:
        if not req.token or not await verify_file(req.url, req.token, client):
            raise HTTPException(status_code=403, detail="Target ownership verification failed")
    orch = get_orchestrator()
    try:
        scan_id = await orch.run_scan(
            target_url=req.url,
            profile_name=req.profile,
            credentials=req.credentials,
            modules=req.modules,
            max_pages=req.max_pages,
            max_depth=req.max_depth,
            seed_endpoints=req.seed_endpoints,
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"scan_id": scan_id, "status": "running"}


class LegacyScanRequest(BaseModel):
    target_id: str
    profile: str = "standard"


@router.post("/scans")
async def start_dashboard_scan(req: LegacyScanRequest):
    target = _targets.get(req.target_id)
    if not target:
        raise HTTPException(status_code=404, detail="Target not found; register it again")
    if not target.get("verified"):
        raise HTTPException(status_code=403, detail="Verify target ownership before scanning")
    # Recheck proof immediately before each scan.
    async with GuardedClient(timeout=10.0, follow_redirects=True) as client:
        if not await verify_file(target["url"], target["token"], client):
            target["verified"] = False
            raise HTTPException(status_code=403, detail="Ownership verification has expired")
    try:
        scan_id = await get_orchestrator().run_scan(
            target_url=target["url"],
            profile_name=req.profile or "standard",
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"id": scan_id, "scan_id": scan_id, "status": "running", "profile": req.profile}


class DashboardControlRequest(BaseModel):
    action: str


class DashboardAskRequest(BaseModel):
    question: str


@router.post("/scans/{scan_id}/control")
async def control_dashboard_scan(scan_id: str, req: DashboardControlRequest):
    orch = get_orchestrator()
    return orch.control_scan(scan_id, req.action)


@router.post("/scans/{scan_id}/ask")
async def ask_dashboard_spider(scan_id: str, req: DashboardAskRequest):
    q = (req.question or "").strip()
    if not q:
        raise HTTPException(status_code=400, detail="Question is required")
    conn = get_db()
    try:
        scan_row = conn.execute(
            "SELECT risk_score, raw_count, confirmed_count FROM scans WHERE id = ?",
            (scan_id,),
        ).fetchone()
        finding_rows = conn.execute(
            """SELECT f.id, f.module, f.url, f.param, f.signal, f.status,
                      t.verdict, t.severity, t.owasp, t.confidence, t.reason
               FROM findings f
               LEFT JOIN triage t ON t.finding_id = f.id
               WHERE f.scan_id = ?""",
            (scan_id,),
        ).fetchall()
    except Exception:
        scan_row = None
        finding_rows = []
    finally:
        conn.close()

    findings_list = [dict(r) for r in finding_rows]
    confirmed = [
        f for f in findings_list if (f.get("verdict") or f.get("status")) == "confirmed"
    ]
    risk_score = (scan_row["risk_score"] if scan_row and scan_row["risk_score"] is not None else 0)
    if not confirmed:
        return {
            "answer": f"Scan `{scan_id[:8]}` currently has 0 confirmed findings (Risk Score: {risk_score}/100). Launch or complete a scan to analyze live endpoints.",
            "grounded_count": 0,
        }

    sev_weights = {"Critical": 4, "High": 3, "Medium": 2, "Low": 1}
    by_endpoint: dict[str, list[dict]] = {}
    for f in confirmed:
        ep = f.get("url") or "/"
        by_endpoint.setdefault(ep, []).append(f)

    riskiest_ep = max(
        by_endpoint.items(),
        key=lambda kv: sum(sev_weights.get(str(x.get("severity", "Medium")).capitalize(), 1) for x in kv[1]),
    )
    ql = q.lower()
    if "risk" in ql or "endpoint" in ql or "worst" in ql or "where" in ql:
        top_ep, ep_findings = riskiest_ep
        mods = ", ".join(sorted({str(x.get("module", "probe")).upper() for x in ep_findings}))
        top_sev = ep_findings[0].get("severity", "High")
        return {
            "answer": f"Your riskiest endpoint is `{top_ep}` with {len(ep_findings)} confirmed finding(s) ({mods}, top severity: {top_sev}). Overall target Risk Score is {risk_score}/100 across {len(confirmed)} confirmed issues.",
            "grounded_count": len(confirmed),
        }
    if "fix" in ql or "first" in ql or "remediat" in ql or "priority" in ql:
        sorted_conf = sorted(
            confirmed,
            key=lambda x: sev_weights.get(str(x.get("severity", "Medium")).capitalize(), 1),
            reverse=True,
        )
        first = sorted_conf[0]
        return {
            "answer": f"Prioritize fixing `{str(first.get('module', '')).upper()}` on `{first.get('url')}` [{first.get('severity', 'High')}] first ({first.get('owasp', 'OWASP Top 10')}). Remediating this root cause and dragging its FIXED? badge onto the spider will verify the patch.",
            "grounded_count": len(confirmed),
        }
    mods_summary = ", ".join(sorted({f"{str(x.get('module')).upper()} ({x.get('severity')})" for x in confirmed[:6]}))
    return {
        "answer": f"NikSpider confirmed {len(confirmed)} finding(s) (Risk Score {risk_score}/100): {mods_summary}. Riskiest route: `{riskiest_ep[0]}`.",
        "grounded_count": len(confirmed),
    }


@router.get("/scans/{scan_id}")
async def get_scan(scan_id: str):
    orch = get_orchestrator()
    result = orch.get_results(scan_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Scan not found")
    return result


@router.get("/scans/{scan_id}/stream")
async def stream_scan(scan_id: str, request: Request):
    orch = get_orchestrator()

    async def event_gen():
        sent_roadmap_ready = False
        async for ev in orch.stream_progress(scan_id):
            if await request.is_disconnected():
                break
            kind = ev["event"]
            if kind == "sse":
                data = ev.get("data", {})
                if isinstance(data, dict) and data.get("type") == "roadmap_ready":
                    sent_roadmap_ready = True
                yield f"data: {json.dumps(data, default=str)}\n\n"
            elif kind == "progress":
                payload = {"type": "crawl_progress", "pages": 0, "queue": 0}
                yield f"data: {json.dumps(payload, default=str)}\n\n"
            elif kind == "complete":
                if not sent_roadmap_ready:
                    payload = {"type": "roadmap_ready", "nodes": ev["data"].get("findings_count", 0), "score": ev["data"].get("risk_score", 0)}
                    yield f"data: {json.dumps(payload, default=str)}\n\n"
            else:
                data = ev["data"]
                payload = {"type": "error", "message": data if isinstance(data, str) else json.dumps(data)}
                yield f"data: {json.dumps(payload, default=str)}\n\n"

    return StreamingResponse(
        event_gen(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/scans/{scan_id}/report")
async def get_report(scan_id: str):
    orch = get_orchestrator()
    result = orch.get_results(scan_id)
    if result is None or result.get("status") != "completed":
        raise HTTPException(status_code=404, detail="Scan not found or not finished")
    return result.get("report", {})


@router.get("/scans/{scan_id}/roadmap")
async def get_roadmap(scan_id: str):
    orch = get_orchestrator()
    result = orch.get_results(scan_id)
    if result is not None and result.get("status") == "completed":
        rm_nodes = result.get("roadmap_nodes") or []
        if rm_nodes:
            # Read latest node statuses and risk score from SQLite in case retests updated them
            conn = get_db()
            try:
                scan_row = conn.execute("SELECT risk_score, raw_count, confirmed_count FROM scans WHERE id = ?", (scan_id,)).fetchone()
                node_rows = conn.execute("SELECT id, json, status FROM roadmap_nodes WHERE scan_id = ?", (scan_id,)).fetchall()
                if node_rows:
                    db_nodes = []
                    for r in node_rows:
                        try:
                            nd = json.loads(r["json"])
                        except Exception:
                            nd = {}
                        nd["id"] = r["id"]
                        nd["status"] = r["status"]
                        db_nodes.append(nd)
                    rm_nodes = db_nodes
                score = (scan_row["risk_score"] if scan_row and scan_row["risk_score"] is not None else result.get("risk_score", 0))
            finally:
                conn.close()
            return {
                "nodes": rm_nodes,
                "score": score,
                "raw_count": result.get("findings_count", len(rm_nodes)),
                "confirmed_count": result.get("findings_count", len(rm_nodes)),
                "rejected_count": 0,
            }
        report = result.get("report", {})
        entries = report.get("findings", [])
        nodes = []
        for entry in entries:
            severity = str(entry.get("severity", "low")).capitalize()
            nodes.append({
                "id": entry.get("id", ""), "issue": f"{entry.get('module', 'Security')} finding",
                "severity": severity, "owasp": entry.get("owasp", ""),
                "root_cause": entry.get("reason", ""), "affects": [entry.get("url", "")],
                "fix_steps": [entry.get("fix", "Review and remediate the finding.")],
                "code_example": entry.get("snippet", ""),
                "verify": entry.get("evidence", "Re-run the check after remediation."),
                "resolves_count": 1, "status": "open", "finding_ids": [entry.get("id", "")],
            })
        return {"nodes": nodes, "score": result.get("risk_score", 0),
                "raw_count": result.get("findings_count", 0),
                "confirmed_count": result.get("findings_count", 0), "rejected_count": 0}
    raise HTTPException(status_code=404, detail="Scan not found or not finished")


@router.get("/scans/{scan_id}/requests")
async def get_scan_requests(scan_id: str):
    conn = get_db()
    try:
        rows = conn.execute(
            "SELECT id, scan_id, ts, method, url, status FROM request_log WHERE scan_id = ? ORDER BY id DESC LIMIT 200",
            (scan_id,),
        ).fetchall()
        return [dict(row) for row in rows]
    finally:
        conn.close()


@router.post("/findings/{finding_id}/retest")
async def retest_dashboard_finding(finding_id: str):
    conn = get_db()
    try:
        row = conn.execute("SELECT * FROM findings WHERE id = ?", (finding_id,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Finding not found")
        finding = dict(row)
        if isinstance(finding.get("extra"), str):
            try:
                finding["extra"] = json.loads(finding["extra"])
            except json.JSONDecodeError:
                finding["extra"] = {}
    finally:
        conn.close()
    async with GuardedClient(timeout=15.0, follow_redirects=True, verify=False) as client:
        result = await retest_finding(finding, client)
    passed = result["status"] == "fixed"
    if passed:
        try:
            conn = get_db()
            scan_id_db = finding.get("scan_id", "")
            with conn:
                conn.execute("UPDATE findings SET status = 'fixed' WHERE id = ?", (finding_id,))
                if scan_id_db:
                    rows = conn.execute("SELECT id, json FROM roadmap_nodes WHERE scan_id = ?", (scan_id_db,)).fetchall()
                    for r in rows:
                        try:
                            nd = json.loads(r["json"])
                        except Exception:
                            continue
                        if finding_id in nd.get("finding_ids", []):
                            nd["status"] = "fixed"
                            conn.execute(
                                "UPDATE roadmap_nodes SET status = 'fixed', json = ? WHERE id = ?",
                                (json.dumps(nd, default=str), r["id"]),
                            )
                    from nikspider.stage5_report.roadmap import calculate_risk_score as calc_score
                    score_rows = conn.execute("SELECT json FROM roadmap_nodes WHERE scan_id = ?", (scan_id_db,)).fetchall()
                    nodes_open = [json.loads(r["json"]) for r in score_rows if r["json"]]
                    new_score = calc_score(nodes_open)
                    conn.execute("UPDATE scans SET risk_score = ? WHERE id = ?", (new_score, scan_id_db))
                    result["score"] = new_score
            conn.close()
        except Exception:
            pass
    return {"passed": passed, **result}


@router.post("/nodes/{node_id}/prompt")
async def get_dashboard_node_prompt(node_id: str):
    conn = get_db()
    try:
        row = conn.execute("SELECT json FROM roadmap_nodes WHERE id = ?", (node_id,)).fetchone()
    finally:
        conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="Roadmap item not found")
    try:
        node = json.loads(row["json"])
    except (TypeError, json.JSONDecodeError):
        node = {}
    if isinstance(node, str):
        try:
            node = json.loads(node)
        except json.JSONDecodeError:
            node = {}
    if node.get("fix_steps") or node.get("code_example"):
        issue = node.get("issue", "Security Fix")
        fix_steps = node.get("fix_steps", [])
        code_example = node.get("code_example", "")
        verify = node.get("verify", "")
        prompt = f"### Security Fix Specification for AI Assistant\n- Fix issue: {issue}\n"
        for step in fix_steps:
            prompt += f"- {step}\n"
        if code_example:
            prompt += f"\n```\n{code_example}\n```\n"
        if verify:
            prompt += f"\nVerify: {verify}"
        return {"prompt": prompt}
    prompt = node.get("fix", "") or node.get("snippet", "") or node.get("reason", "")
    if not prompt:
        prompt = f"Remediate the {node.get('module', 'security')} finding at {node.get('url', '')}, then verify the fix with a retest."
    return {"prompt": prompt}


@router.get("/scans/{scan_id}/evidence")
async def get_evidence(scan_id: str):
    """Retrieve evidence records for a scan's findings."""
    try:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute(
            "SELECT id FROM findings WHERE scan_id = ?",
            (scan_id,)
        )
        finding_ids = [r["id"] for r in cursor.fetchall()]
        conn.close()
    except Exception:
        finding_ids = []

    from nikspider.stage3_spiderweb.evidence_store import get_evidence
    evidence = {}
    for fid in finding_ids:
        evidence[fid] = get_evidence(fid)
    return {"scan_id": scan_id, "evidence": evidence}


@router.post("/oast/callback/{path:path}")
async def oast_callback(request: Request, path: str):
    """OAST listener callback endpoint (mirrors oast_listener server)."""
    from nikspider.stage2_spiderpois.oracles.inband import oast_mark_hit
    body = await request.body()
    client_ip = request.client.host if request.client else "unknown"
    full_url = str(request.url)
    hit_any = False
    from nikspider.stage2_spiderpois.oracles.inband import OAST_CALLBACKS
    for token in list(OAST_CALLBACKS.keys()):
        if token in full_url or token in body.decode(errors="replace"):
            oast_mark_hit(token, client_ip)
            hit_any = True
    return PlainTextResponse("ok" if hit_any else "noop")
