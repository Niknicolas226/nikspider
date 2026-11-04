#!/usr/bin/env python3
"""NikSpider API Server (FastAPI + SSE).

Serves the React frontend and exposes:
  - POST /api/v2/targets          Create/verify target
  - POST /api/v2/targets/:id/verify
  - POST /api/v2/scans             Start a scan
  - GET  /api/v2/scans/:id/stream  SSE progress stream
  - GET  /api/v2/scans/:id/roadmap Get scan roadmap
  - GET  /api/v2/scans/:id/requests Get request logs
  - POST /api/v2/findings/:id/retest Retest a finding
  - POST /api/v2/nodes/:id/prompt  Get fix prompt

Usage:
    python -m nikspider.backend.server
    uvicorn nikspider.backend.server:app --port 8000 --reload
"""

import asyncio
import json
import os
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

# Ensure nikspider package is importable
_NIKSPIDER_ROOT = Path(__file__).resolve().parents[2]
if str(_NIKSPIDER_ROOT) not in sys.path:
    sys.path.insert(0, str(_NIKSPIDER_ROOT))

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

# ---------------------------------------------------------------------------
# Orchestrator import
# ---------------------------------------------------------------------------
from nikspider.orchestrator import Orchestrator
from nikspider.common.db import get_db, init_db, get_request_logs
from nikspider.stage6_close_the_loop.retest import retest_finding as do_retest
from nikspider.stage5_report.roadmap import SEVERITY_ORDER

# ---------------------------------------------------------------------------
# App setup
# ---------------------------------------------------------------------------
app = FastAPI(
    title="NikSpider API",
    version="2.0.0",
    description="AI-Powered Autonomous Web Application Security Assessment Platform",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Global orchestrator (in-memory)
# ---------------------------------------------------------------------------
_orchestrator: Orchestrator | None = None


def get_orchestrator() -> Orchestrator:
    global _orchestrator
    if _orchestrator is None:
        demo_mode = os.getenv("DEMO_MODE", "0") in ("1", "true", "yes")
        llm_enabled = bool(os.getenv("LLM_API_KEY") or os.getenv("OPENAI_API_KEY"))
        _orchestrator = Orchestrator(demo_mode=demo_mode, llm_enabled=llm_enabled)
    return _orchestrator


def _find_frontend_dist() -> Path:
    for candidate in (
        _NIKSPIDER_ROOT / "nikspider" / "frontend" / "dist",
        _NIKSPIDER_ROOT / "frontend" / "dist",
    ):
        if candidate.exists():
            return candidate
    return _NIKSPIDER_ROOT / "nikspider" / "frontend" / "dist"


@app.on_event("startup")
async def startup():
    init_db()
    # Ensure frontend dist exists
    dist_dir = _find_frontend_dist()
    if not dist_dir.exists():
        print("[server] Frontend not built. Run: cd frontend && npm run build")


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------
class TargetCreate(BaseModel):
    url: str


class ScanCreate(BaseModel):
    target_id: str
    profile: str = "standard"
    modules: list[str] | None = None
    max_pages: int = 200
    max_depth: int = 3


class RetestRequest(BaseModel):
    pass


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

# Serve frontend static files
@app.get("/")
async def index():
    """Serve the React frontend."""
    dist = _find_frontend_dist()
    index_html = dist / "index.html"
    if index_html.exists():
        from fastapi.responses import FileResponse
        return FileResponse(index_html)
    return {"message": "NikSpider API Server. Frontend not built - run: cd frontend && npm run build"}


# ---------------------------------------------------------------------------
# API v2
# ---------------------------------------------------------------------------
api = FastAPI(title="NikSpider API v2")


@api.get("/llm/status")
async def get_llm_status():
    """Return current LLM gateway configuration and live vs. mock fallback status."""
    from nikspider.stage3_5_llm_gateway.llm_gateway import LLMGateway, LAST_LLM_STATUS
    gw = LLMGateway()
    return {
        "available": gw.available,
        "provider": gw.provider,
        "model": gw.model,
        "model_heavy": gw.model_heavy,
        "base_url": gw.base_url,
        "last_call_status": LAST_LLM_STATUS,
    }


@api.get("/health")
async def health():
    demo_mode = os.getenv("DEMO_MODE", "0").lower() in ("1", "true", "yes")
    return {
        "status": "ok",
        "service": "nikspider-api-v2",
        "demo_mode": demo_mode,
        "time": datetime.now(timezone.utc).isoformat(),
    }


@api.get("/targets/{target_id}/history")
async def get_target_history(target_id: str):
    conn = get_db()
    try:
        t_row = conn.execute("SELECT url FROM targets WHERE id = ?", (target_id,)).fetchone()
        if t_row:
            rows = conn.execute(
                """SELECT s.id, s.risk_score, s.raw_count, s.confirmed_count, s.started_at
                   FROM scans s
                   JOIN targets t ON s.target_id = t.id
                   WHERE t.url = ?
                   ORDER BY s.started_at ASC LIMIT 20""",
                (t_row["url"],),
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


@api.post("/targets")
async def create_target(body: TargetCreate):
    """Create a new target and return ownership verification token."""
    from nikspider.stage0_intake_guard.verify import new_token
    from nikspider.stage0_intake_guard.guard import is_allowed_target

    if not is_allowed_target(body.url):
        raise HTTPException(status_code=400, detail="Target URL is blocked (private/restricted IP).")

    target_id = str(uuid.uuid4())[:12]
    token = new_token()

    # In demo mode, write the fresh token to the shared .nikspider-token file
    # so demo_app serves the exact token we generated for verification.
    demo_mode = os.getenv("DEMO_MODE", "0") in ("1", "true", "yes")
    if demo_mode:
        token_file = _NIKSPIDER_ROOT / ".nikspider-token"
        try:
            token_file.write_text(token, encoding="utf-8")
        except Exception:
            pass

    conn = get_db()
    with conn:
        conn.execute(
            "INSERT OR IGNORE INTO targets (id, url, token, verified_at) VALUES (?, ?, ?, ?)",
            (target_id, body.url, token, None),
        )
    conn.close()

    return {"id": target_id, "url": body.url, "token": token, "verified": False}


@api.post("/targets/{target_id}/verify")
async def verify_target(target_id: str):
    """Verify target ownership by checking the token file."""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT url, token FROM targets WHERE id = ?", (target_id,))
    row = cursor.fetchone()
    conn.close()

    if not row:
        raise HTTPException(status_code=404, detail="Target not found")

    from nikspider.stage0_intake_guard.verify import verify_file
    import httpx

    verified = False
    async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
        verified = await verify_file(row["url"], row["token"], client)

    if verified:
        conn = get_db()
        with conn:
            conn.execute(
                "UPDATE targets SET verified_at = ? WHERE id = ?",
                (datetime.now(timezone.utc).isoformat(), target_id),
            )
        conn.close()

    return {"verified": verified}


@api.post("/scans")
async def start_scan(body: ScanCreate):
    """Start a new security scan."""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT url FROM targets WHERE id = ?", (body.target_id,))
    row = cursor.fetchone()
    conn.close()

    if not row:
        raise HTTPException(status_code=404, detail="Target not found")

    orch = get_orchestrator()
    scan_id = await orch.run_scan(
        target_url=row["url"],
        profile_name=body.profile,
        modules=body.modules,
        max_pages=body.max_pages,
        max_depth=body.max_depth,
    )
    return {"id": scan_id, "status": "started"}


class ScanControlBody(BaseModel):
    action: str  # "pause" | "resume" | "stop"


class ScanAskBody(BaseModel):
    question: str


@api.post("/scans/{scan_id}/control")
async def control_scan_endpoint(scan_id: str, body: ScanControlBody):
    """Pause, resume, or stop a scan between probes/stages."""
    orch = get_orchestrator()
    return orch.control_scan(scan_id, body.action)


@api.post("/scans/{scan_id}/ask")
async def ask_spider_endpoint(scan_id: str, body: ScanAskBody):
    """Stage 3.5 grounded Q&A assistant anchored to the spider mascot."""
    q = (body.question or "").strip()
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

    # Try Stage 3.5 LLMGateway first if API key is configured, otherwise grounded deterministic synthesis
    orch = get_orchestrator()
    if orch.llm and orch.llm.available and confirmed:
        try:
            ctx_lines = [
                f"- [{f.get('severity', 'Medium')}] {f.get('module')} on {f.get('url')} (param={f.get('param') or 'n/a'}): {f.get('reason') or f.get('signal')}"
                for f in confirmed[:12]
            ]
            prompt = (
                f"You are NikSpider AI Assistant. Answer concisely (2-3 sentences max) grounded strictly in these scan findings (Risk Score {risk_score}/100):\n"
                + "\n".join(ctx_lines)
                + f"\n\nUser Question: {q}"
            )
            resp = await orch.llm.complete(prompt)
            if resp and isinstance(resp, str) and len(resp.strip()) > 10:
                return {"answer": resp.strip(), "grounded_count": len(confirmed)}
        except Exception:
            pass

    if not confirmed:
        return {
            "answer": f"Scan `{scan_id[:8]}` currently has 0 confirmed findings (Risk Score: {risk_score}/100). Launch or complete a scan to analyze live endpoints.",
            "grounded_count": 0,
        }

    # Group by endpoint & severity to answer grounded questions deterministically
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


@api.get("/scans/{scan_id}/stream")
async def scan_stream(scan_id: str, request: Request):
    """SSE stream of scan progress compatible with frontend EventSource."""
    orch = get_orchestrator()

    async def event_generator():
        sent_roadmap_ready = False
        async for ev in orch.stream_progress(scan_id):
            if await request.is_disconnected():
                break
            kind = ev.get("event", "message")
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
                    data_dict = ev.get("data") if isinstance(ev.get("data"), dict) else {}
                    payload = {
                        "type": "roadmap_ready",
                        "nodes": data_dict.get("findings_count", 0),
                        "score": data_dict.get("risk_score", 0),
                    }
                    yield f"data: {json.dumps(payload, default=str)}\n\n"
            else:
                data = ev.get("data", "")
                payload = {"type": "error", "message": data if isinstance(data, str) else json.dumps(data)}
                yield f"data: {json.dumps(payload, default=str)}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@api.get("/scans/{scan_id}/roadmap")
async def get_roadmap(scan_id: str):
    """Get the repair roadmap for a completed scan.

    Reads nodes from the DB (like the v1 API) so status updates from
    retests are reflected, and computes counts from triage verdicts.
    """
    conn = get_db()
    cursor = conn.cursor()
    try:
        cursor.execute(
            "SELECT risk_score, raw_count, confirmed_count FROM scans WHERE id = ?",
            (scan_id,),
        )
        scan_row = cursor.fetchone()
        if not scan_row:
            conn.close()
            return {
                "score": 0,
                "raw_count": 0,
                "confirmed_count": 0,
                "rejected_count": 0,
                "nodes": [],
            }

        cursor.execute(
            "SELECT id, parent_id, json, status FROM roadmap_nodes WHERE scan_id = ?",
            (scan_id,),
        )
        node_rows = cursor.fetchall()

        nodes = []
        for r in node_rows:
            try:
                node_data = json.loads(r["json"])
            except Exception:
                node_data = {}
            node_data["id"] = r["id"]
            node_data["status"] = r["status"]
            nodes.append(node_data)
        nodes.sort(key=lambda n: SEVERITY_ORDER.get(str(n.get("severity", "Medium")).capitalize(), 99))

        # Count verdicts from the triage table for this scan's findings
        cursor.execute(
            """SELECT t.verdict, COUNT(*) as cnt FROM triage t
               JOIN findings f ON f.id = t.finding_id
               WHERE f.scan_id = ? GROUP BY t.verdict""",
            (scan_id,),
        )
        verdict_counts = {dict(r)["verdict"]: dict(r)["cnt"] for r in cursor.fetchall()}
    finally:
        conn.close()

    confirmed = verdict_counts.get("confirmed", 0)
    rejected = verdict_counts.get("rejected", 0) + verdict_counts.get("needs_more_evidence", 0)

    return {
        "score": scan_row["risk_score"] or 0,
        "raw_count": scan_row["raw_count"] or len(node_rows),
        "confirmed_count": confirmed or scan_row["confirmed_count"] or 0,
        "rejected_count": rejected,
        "nodes": nodes,
    }


@api.get("/scans/{scan_id}/requests")
async def get_requests(scan_id: str):
    """Get request log entries for a scan."""
    logs = get_request_logs(scan_id, limit=200)
    return logs


@api.post("/findings/{finding_id}/retest")
async def retest_finding(finding_id: str):
    """Retest a specific finding."""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM findings WHERE id = ?", (finding_id,))
    row = cursor.fetchone()
    conn.close()

    if not row:
        raise HTTPException(status_code=404, detail="Finding not found")

    import httpx
    from nikspider.stage0_intake_guard.guard import GuardedClient

    finding_dict = dict(row)
    # Parse the `extra` JSON blob from the DB so module retest handlers
    # can read extra.get("type") / get("method") / etc.
    if finding_dict.get("extra"):
        try:
            finding_dict["extra"] = json.loads(finding_dict["extra"])
        except Exception:
            finding_dict["extra"] = {}

    async with GuardedClient(timeout=15.0, follow_redirects=True, verify=False) as client:
        result = await do_retest(finding_dict, client)

    passed = result.get("status") == "fixed"
    status = result.get("status", "unknown")

    # On success, mark matching roadmap nodes as fixed and recompute the
    # scan risk score so the persisted roadmap reflects the fix.
    if passed:
        try:
            conn = get_db()
            scan_id_db = finding_dict.get("scan_id", "")
            with conn:
                conn.execute("UPDATE findings SET status = 'fixed' WHERE id = ?", (finding_id,))
                if scan_id_db:
                    rows = conn.execute(
                        "SELECT id, json FROM roadmap_nodes WHERE scan_id = ?", (scan_id_db,)
                    ).fetchall()
                    for r in rows:
                        try:
                            node_data = json.loads(r["json"])
                        except Exception:
                            continue
                        if finding_id in node_data.get("finding_ids", []):
                            node_data["status"] = "fixed"
                            conn.execute(
                                "UPDATE roadmap_nodes SET status = 'fixed', json = ? WHERE id = ?",
                                (json.dumps(node_data, default=str), r["id"]),
                            )
                    # Recompute risk score from remaining open nodes
                    from nikspider.stage5_report.roadmap import calculate_risk_score as calc_score
                    score_rows = conn.execute(
                        "SELECT json FROM roadmap_nodes WHERE scan_id = ?", (scan_id_db,)
                    ).fetchall()
                    nodes_open = []
                    for r in score_rows:
                        try:
                            nd = json.loads(r["json"])
                        except Exception:
                            continue
                        nodes_open.append(nd)
                    new_score = calc_score(nodes_open)
                    conn.execute(
                        "UPDATE scans SET risk_score = ? WHERE id = ?", (new_score, scan_id_db)
                    )
                    result["score"] = new_score
            conn.close()
        except Exception:
            pass

    return {"passed": passed, "status": status, "message": result.get("message", ""), "score": result.get("score")}


@api.post("/nodes/{node_id}/prompt")
async def get_node_prompt(node_id: str):
    """Generate a fix prompt for a roadmap node."""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT id, json FROM roadmap_nodes WHERE id = ?", (node_id,))
    row = cursor.fetchone()
    conn.close()

    if not row:
        raise HTTPException(status_code=404, detail="Node not found")

    node_data = json.loads(row["json"]) if isinstance(row["json"], str) else row["json"]
    issue = node_data.get("issue", "Security Fix")
    fix_steps = node_data.get("fix_steps", [])
    code_example = node_data.get("code_example", "")
    verify = node_data.get("verify", "")

    prompt = f"### Security Fix Specification for AI Assistant\n- Fix issue: {issue}\n"
    for step in fix_steps:
        prompt += f"- {step}\n"
    if code_example:
        prompt += f"\n```\n{code_example}\n```\n"
    if verify:
        prompt += f"\nVerify: {verify}"

    return {"prompt": prompt}


# Mount the v2 API sub-application
from api.routes.evidence import evidence_router
from api.websocket import ws_router

app.include_router(evidence_router)
app.include_router(ws_router)
api.include_router(evidence_router)
api.include_router(ws_router)
app.mount("/api/v2", api)

# Mount frontend static assets
from fastapi.staticfiles import StaticFiles
dist_dir = _find_frontend_dist()
assets_dir = dist_dir / "assets"
if assets_dir.exists():
    app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------
def main():
    import uvicorn
    host = os.getenv("NIKSPIDER_HOST", "0.0.0.0")
    port = int(os.getenv("NIKSPIDER_PORT", "8000"))
    print(f"NikSpider API Server starting on http://{host}:{port}")
    uvicorn.run("nikspider.backend.server:app", host=host, port=port, reload=True, log_level="info")


if __name__ == "__main__":
    main()