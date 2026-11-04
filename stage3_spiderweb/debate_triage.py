"""Debate triage API (appended): triage(), triage_all_findings().

Kept in a separate module for clarity, re-exported by triage.py.
"""

import asyncio
import json

from nikspider.common.models import Finding


async def _agents_and_verdict(f_dict: dict, cfg: dict | None):
    from nikspider.stage3_spiderweb.triage import (
        debate_agent_a, debate_agent_b, judge_debate, enforce,
    )
    a = await debate_agent_a(f_dict, cfg=cfg)
    b = await debate_agent_b(f_dict, cfg=cfg)
    v_raw = await judge_debate(f_dict, a, b, cfg=cfg)
    return a, b, v_raw, enforce


async def triage(f: Finding | dict, client=None, cfg: dict | None = None) -> dict:
    """Two-agent debate + judicial triage with hard evidence enforcement.

    Never defaults to confirmed when the model is unavailable: an unparseable
    or failed judge yields `needs_more_evidence` with low confidence.
    """
    from nikspider.stage3_spiderweb.triage import VALID_VERDICTS, enforce

    f_dict = f.to_dict() if isinstance(f, Finding) else dict(f)
    if isinstance(f_dict.get("extra"), str):
        try:
            f_dict["extra"] = json.loads(f_dict["extra"])
        except Exception:
            f_dict["extra"] = {}

    try:
        a, b, v_raw, _ = await _agents_and_verdict(f_dict, cfg)
        verdict_clean = str(v_raw.get("verdict", "rejected")).lower()
        if verdict_clean not in VALID_VERDICTS:
            verdict_clean = "rejected"
        v = {
            "verdict": verdict_clean,
            "severity": str(v_raw.get("severity", "Medium")).capitalize(),
            "owasp": str(v_raw.get("owasp", "")),
            "confidence": v_raw.get("confidence", "high"),
            "reason": str(v_raw.get("reason", "")),
            "evidence_quote": str(v_raw.get("evidence_quote", "")),
        }
        v = enforce(f_dict, v)
        source = "llm"
    except Exception as e:
        a = b = ""
        v = {
            "verdict": "needs_more_evidence",
            "severity": "Low",
            "owasp": ("A05:2021-Security Misconfiguration"
                      if f_dict.get("module") == "session"
                      else "A03:2021-Injection"),
            "reason": f"Judge unavailable: {type(e).__name__}",
            "confidence": "low",
            "evidence_quote": "",
        }
        source = "fallback"

    conf_val = v.get("confidence", 0.9)
    if isinstance(conf_val, str):
        confidence_float = {"high": 0.95, "medium": 0.75, "low": 0.40}.get(
            conf_val.lower(), 0.85)
    else:
        try:
            confidence_float = float(conf_val)
        except (TypeError, ValueError):
            confidence_float = 0.85

    default_owasp = ("A05:2021-Security Misconfiguration"
                     if f_dict.get("module") == "session"
                     else "A03:2021-Injection")
    return {
        "finding": f_dict,
        "finding_id": f_dict.get("id") or getattr(f, "id", ""),
        "agent_a": a,
        "agent_b": b,
        "verdict": v.get("verdict", "rejected"),
        "severity": v.get("severity", "Medium"),
        "owasp": v.get("owasp") or default_owasp,
        "confidence": confidence_float,
        "reason": v.get("reason", ""),
        "evidence_quote": v.get("evidence_quote", ""),
        "source": source,
        "verdict_data": v,
        "evidence": {
            "request": f_dict.get("request", ""),
            "response_excerpt": (f_dict.get("response", "") or "")[:500],
            "signal": f_dict.get("signal", ""),
        },
    }


# Alias for backward compatibility
triage_finding = triage


async def triage_all_findings(findings: list, client=None,
                              cfg: dict | None = None) -> list[dict]:
    """Run the debate triage across all findings concurrently."""
    if not findings:
        return []
    return await asyncio.gather(*[triage(f, client=client, cfg=cfg) for f in findings])
