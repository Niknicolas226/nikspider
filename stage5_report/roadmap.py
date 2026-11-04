"""Roadmap — groups confirmed findings by root cause into a repair plan.

This is the canonical implementation for the staged package. It is
deterministic and works without an LLM: findings are grouped by module and
mapped to a remediation record. When an LLM gateway is supplied, its grouping
is used instead (with the same validation and fallbacks).

Public API:
    SEVERITY_WEIGHTS, SEVERITY_ORDER
    calculate_risk_score(nodes) -> int
    _infer_finding_ids(node, findings) -> list[str]
    generate_roadmap(findings, triage_map, llm=None) -> (nodes, risk_score)
"""

import uuid
from typing import Any

from nikspider.common.models import Finding

SEVERITY_WEIGHTS = {"Critical": 25, "High": 15, "Medium": 8, "Low": 3}
SEVERITY_ORDER = {"Critical": 0, "High": 1, "Medium": 2, "Low": 3}

MODULE_KEYWORDS = {
    "sqli": ["sql", "injection", "query", "database", "parameter"],
    "xss": ["xss", "cross-site", "script", "escap", "html", "reflect"],
    "session": ["session", "cookie", "httponly", "samesite", "flag"],
    "access": ["access", "idor", "authoriz", "permission", "admin", "privilege"],
    "stored_xss": ["stored", "xss", "script", "escap"],
    "idor": ["idor", "object", "authoriz", "ownership"],
    "csrf": ["csrf", "token", "samesite", "forgery"],
    "security_headers": ["header", "csp", "hsts", "x-frame", "nosniff"],
    "exposed_files": ["exposed", ".git", ".env", "debug", "file"],
    "open_redirect": ["redirect", "next", "return"],
    "cors": ["cors", "origin", "credential"],
    "clickjacking": ["clickjack", "frame", "x-frame"],
    "ssrf": ["ssrf", "fetch", "server-side request"],
    "cache": ["cache", "poison", "vary"],
    "oauth_jwt": ["oauth", "jwt", "redirect_uri", "token"],
    "graphql": ["graphql", "introspection", "schema"],
    "subdomain_takeover": ["subdomain", "takeover", "dns", "cname"],
    "websocket": ["websocket", "ws", "origin"],
}


def calculate_risk_score(nodes: list[dict]) -> int:
    """Deterministic 0-100 score from severity weights of open nodes."""
    score = 0
    for node in nodes:
        if node.get("status", "open") == "open":
            sev = node.get("severity", "Medium")
            score += SEVERITY_WEIGHTS.get(sev, 5)
    return min(100, score)


def _infer_finding_ids(node: dict, findings: list[Finding]) -> list[str]:
    """Infer which findings a roadmap node covers when none were supplied.

    Matches module keywords against the node text, then falls back to the first
    finding so every node owns at least one finding (retest depends on it).
    """
    text = " ".join(
        str(node.get(k, ""))
        for k in ("issue", "root_cause", "affects", "code_example")
    ).lower()
    scores: dict[str, int] = {}
    for f in findings:
        kw = MODULE_KEYWORDS.get(f.module, [])
        score = sum(1 for k in kw if k in text)
        if f.param and f.param.lower() in text:
            score += 2
        if f.url and any(
            part for part in f.url.split("/") if len(part) > 3 and part.lower() in text
        ):
            score += 1
        if score:
            scores[f.id] = score
    if scores:
        best = max(scores.values())
        return [fid for fid, sc in scores.items() if sc == best]
    return [findings[0].id] if findings else []


def _calculate_effort(mod: str, sev: str, count: int) -> str:
    """Classify remediation effort as S, M, or L."""
    if mod in ("security_headers", "cors", "clickjacking", "exposed_files") and count <= 2:
        return "S"
    if sev in ("Critical", "High") or count > 3:
        return "L"
    return "M"


def _fallback_nodes(confirmed_findings: list[Finding]) -> list[dict]:
    """Deterministic grouping by module when no LLM grouping is available."""
    from nikspider.stage5_report.roadmap_fixes import SITE_CHECK_FIX, DEFAULT_FIX

    by_module: dict[str, list[Finding]] = {}
    for f in confirmed_findings:
        by_module.setdefault(f.module, []).append(f)

    nodes: list[dict] = []
    for mod, mod_findings in by_module.items():
        issue, sev, owasp, root_cause, fix_steps, code_ex, verify = SITE_CHECK_FIX.get(
            mod, DEFAULT_FIX
        )
        impact = SEVERITY_WEIGHTS.get(sev, 8) * max(1, len(mod_findings))
        effort = _calculate_effort(mod, sev, len(mod_findings))
        nodes.append({
            "id": f"node-{mod}-{uuid.uuid4().hex[:8]}",
            "issue": issue,
            "severity": sev,
            "owasp": owasp,
            "root_cause": root_cause,
            "affects": [f.url for f in mod_findings],
            "fix_steps": list(fix_steps),
            "code_example": code_ex,
            "verify": verify,
            "resolves_count": len(mod_findings),
            "status": "open",
            "finding_ids": [f.id for f in mod_findings],
            "children": [],
            "effort": effort,
            "blocks": [],
            "impact_score": impact,
            "fixed_at": None,
            "retest_history": [],
        })
    return nodes


async def generate_roadmap(
    confirmed_findings: list[Finding],
    triage_map: dict[str, dict] | None = None,
    llm=None,
) -> tuple[list[dict], int]:
    """Group confirmed findings into root-cause roadmap nodes.

    Uses the LLM when provided, otherwise deterministic per-module grouping.
    Returns (nodes, risk_score); nodes are ordered by severity, then breadth.
    """
    if not confirmed_findings:
        return [], 0
    triage_map = triage_map or {}

    nodes = _fallback_nodes(confirmed_findings)

    if llm is not None and getattr(llm, "available", False):
        llm_nodes = await _llm_grouping(confirmed_findings, triage_map, llm)
        if llm_nodes:
            # Ensure every confirmed finding module is represented: if the LLM
            # (or mock fallback) only returned a subset of modules, merge the
            # deterministic fallback nodes for any uncovered findings.
            covered_ids = {fid for n in llm_nodes for fid in n.get("finding_ids", [])}
            uncovered = [f for f in confirmed_findings if f.id not in covered_ids]
            if uncovered:
                llm_nodes.extend(_fallback_nodes(uncovered))
            nodes = llm_nodes

    nodes.sort(
        key=lambda n: (SEVERITY_ORDER.get(n.get("severity", "Medium"), 99),
                       -n.get("resolves_count", 1))
    )

    # Establish dependency links if not already set
    for i, n in enumerate(nodes):
        if not n.get("blocks") and i + 1 < len(nodes):
            # Higher priority / foundation issues block subsequent dependent nodes
            n["blocks"] = [nodes[j]["id"] for j in range(i + 1, min(i + 3, len(nodes)))]

    return nodes, calculate_risk_score(nodes)


async def _llm_grouping(
    confirmed_findings: list[Finding],
    triage_map: dict[str, dict],
    llm,
) -> list[dict]:
    """Ask the LLM to group findings by root cause; validate its output."""
    import json
    import re

    summary = []
    for f in confirmed_findings:
        t = triage_map.get(f.id, {})
        summary.append({
            "finding_id": f.id, "module": f.module, "url": f.url,
            "param": f.param, "signal": (f.signal or "")[:200],
            "severity": t.get("severity", "Medium"),
            "owasp": t.get("owasp", "A03:2021-Injection"),
        })

    prompt = (
        "Group these confirmed security findings by underlying root cause into a "
        "repair roadmap. Return a strict JSON object {\"nodes\": [...]} where each node has keys: "
        "id, issue, severity, owasp, root_cause, affects, fix_steps, "
        "code_example, verify, finding_ids.\n\n"
        f"Findings:\n{json.dumps(summary)}"
    )
    try:
        try:
            text = await llm.acomplete(prompt, use_heavy=True)
        except TypeError:
            text = await llm.acomplete(prompt)
        items = None
        try:
            parsed = json.loads(text)
            if isinstance(parsed, list):
                items = parsed
            elif isinstance(parsed, dict):
                items = (
                    parsed.get("nodes")
                    or parsed.get("roadmap")
                    or next((v for v in parsed.values() if isinstance(v, list)), None)
                )
        except Exception:
            pass
        if items is None:
            match = re.search(r"\[.*\]", text, re.S)
            if not match:
                return []
            items = json.loads(match.group())
    except Exception:
        return []

    valid_ids = {f.id for f in confirmed_findings}
    nodes: list[dict] = []
    for item in items if isinstance(items, list) else []:
        if not isinstance(item, dict) or "issue" not in item:
            continue
        finding_ids = [fid for fid in item.get("finding_ids", []) if fid in valid_ids]
        if not finding_ids:
            finding_ids = _infer_finding_ids(item, confirmed_findings)
        raw_sev = str(item.get("severity", "Medium")).strip().capitalize()
        if raw_sev not in SEVERITY_ORDER:
            raw_sev = "Medium"
        impact = SEVERITY_WEIGHTS.get(raw_sev, 8) * max(1, len(finding_ids))
        effort = item.get("effort") or _calculate_effort("generic", raw_sev, len(finding_ids))
        nodes.append({
            "id": f"{item.get('id') or 'node'}-{uuid.uuid4().hex[:8]}",
            "issue": str(item.get("issue", "Security Fix Node")),
            "severity": raw_sev,
            "owasp": str(item.get("owasp", "A03:2021-Injection")),
            "root_cause": str(item.get("root_cause", "Unvalidated input handling")),
            "affects": item.get("affects", []),
            "fix_steps": item.get("fix_steps", ["Apply input validation"]),
            "code_example": str(item.get("code_example", "# Secure implementation")),
            "verify": str(item.get("verify", "Retest with safe security probe")),
            "resolves_count": len(finding_ids),
            "status": "open",
            "finding_ids": finding_ids,
            "children": item.get("children", []),
            "effort": effort,
            "blocks": item.get("blocks", []),
            "impact_score": impact,
            "fixed_at": None,
            "retest_history": [],
        })
    return nodes
