"""Report builder — generates vulnerability report structure from triaged findings.

Does NOT call LLM — purely assembles data from triage + conclusion + remediation.
"""

import json
from datetime import datetime, timezone
from typing import Any

from nikspider.stage3_spiderweb.triage import TriageResult
from nikspider.stage4_conclusion.conclusion import RiskSummary


def build_report_structure(
    target_url: str,
    scan_id: str,
    findings: list[dict],
    triaged: list[TriageResult],
    risk_summary: RiskSummary,
    fix_prompts: list[dict],
    crawl_map: list[dict] | None = None,
) -> dict:
    """Build a structured vulnerability report dict.

    This is a lightweight dict that exporters (JSON, HTML, PDF) consume.
    """
    # Map finding IDs to triage results
    triage_map: dict[str, dict] = {}
    for tr in triaged:
        triage_map[tr.finding_id] = {
            "verdict": tr.verdict,
            "severity": tr.severity,
            "owasp": tr.owasp,
            "confidence": tr.confidence,
            "reason": tr.reason,
            "evidence_quote": tr.evidence_quote,
        }

    # Map module name to fix prompt
    fix_map: dict[str, dict] = {}
    for fp in fix_prompts:
        fix_map[fp.get("module", "")] = fp

    # Build finding entries
    entries = []
    for f in findings:
        fid = f.get("id", "")
        triage_info = triage_map.get(fid, {})
        fix_info = fix_map.get(f.get("module", ""), {})

        entries.append({
            "id": fid,
            "module": f.get("module", ""),
            "url": f.get("url", ""),
            "param": f.get("param", ""),
            "signal": f.get("signal", ""),
            "status": f.get("status", "raw"),
            "severity": triage_info.get("severity", "unknown"),
            "owasp": triage_info.get("owasp", ""),
            "confidence": triage_info.get("confidence", 0),
            "reason": triage_info.get("reason", ""),
            "evidence": triage_info.get("evidence_quote", ""),
            "fix": fix_info.get("fix", ""),
            "owasp_ref": fix_info.get("owasp_ref", ""),
            "snippet": fix_info.get("snippet", ""),
        })

    # Sort by severity
    sort_order = {"critical": 0, "high": 1, "medium": 2, "low": 3, "info": 4}
    entries.sort(key=lambda e: sort_order.get(e["severity"], 9))

    report = {
        "title": f"Security Assessment Report — {target_url}",
        "scan_id": scan_id,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "target_url": target_url,
        "risk_summary": {
            "score": risk_summary.risk_score,
            "total_findings": risk_summary.total_findings,
            "severity_counts": risk_summary.severity_counts,
            "by_module": risk_summary.by_module,
            "owasp_categories": risk_summary.owasp_categories,
            "summary": risk_summary.triage_summary,
            "top_risks": risk_summary.top_risks,
        },
        "findings": entries,
        "crawl_summary": {
            "pages_crawled": len(crawl_map) if crawl_map else 0,
        },
        "remediation_summary": fix_prompts,
    }
    return report


def build_roadmap_nodes(
    report: dict,
    scan_id: str,
) -> list[dict]:
    """Build roadmap nodes for the frontend tree view.

    Each finding becomes a roadmap node under the scan root.
    """
    nodes = []

    # Root node
    nodes.append({
        "id": scan_id,
        "scan_id": scan_id,
        "parent_id": None,
        "json": json.dumps({"type": "root", "label": "Scan Results"}),
        "status": "open",
    })

    for finding in report.get("findings", []):
        node_id = finding["id"]
        nodes.append({
            "id": node_id,
            "scan_id": scan_id,
            "parent_id": scan_id,
            "json": json.dumps(finding),
            "status": "open" if finding["severity"] in ("critical", "high") else "closed",
        })

    return nodes


def build_fix_prompt_texts(fix_prompts: list[dict]) -> list[dict]:
    """Build structured fix prompt objects with all metadata needed by the frontend."""
    prompts = []
    for fp in fix_prompts:
        prompts.append({
            "module": fp.get("module", ""),
            "severity": fp.get("severity", "unknown"),
            "owasp": fp.get("owasp", ""),
            "fix": fp.get("fix", ""),
            "owasp_ref": fp.get("owasp_ref", ""),
            "snippet": fp.get("snippet", ""),
            "signal": fp.get("signal", ""),
        })
    # Sort by severity
    sort_order = {"critical": 0, "high": 1, "medium": 2, "low": 3, "info": 4}
    prompts.sort(key=lambda p: sort_order.get(p["severity"], 9))
    return prompts