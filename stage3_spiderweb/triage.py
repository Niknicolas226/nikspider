"""Debate-based triage — two LLM agents debate each raw finding.

Agent A proposes a verdict, Agent B challenges it. A synthesizer resolves.
For raw (non-LLM) use: fall back to signature-based classification.
"""

import json
import re
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any

from nikspider.common.models import Finding


# Static signature-based severity rules (used as LLM fallback or when LLM is off)
STATIC_RULES = {
    "sqli": {
        "error-based": ("sql-injection", "critical", 0.95),
        "boolean-differential": ("sql-injection", "high", 0.85),
    },
    "xss": {
        "reflected": ("xss", "high", 0.85),
        "dom_xss": ("xss", "medium", 0.70),
    },
    "ssrf": {
        "oast": ("ssrf", "high", 0.90),
    },
    "idor": {
        "default": ("insecure-direct-object-reference", "high", 0.80),
    },
    "csrf": {
        "default": ("cross-site-request-forgery", "medium", 0.75),
    },
    "headers": {
        "default": ("security-misconfiguration", "low", 0.60),
    },
    "cors": {
        "default": ("security-misconfiguration", "medium", 0.70),
    },
    "session": {
        "default": ("broken-authentication", "medium", 0.70),
    },
    "clickjacking": {
        "default": ("clickjacking", "low", 0.60),
    },
    "exposed_files": {
        "default": ("security-misconfiguration", "medium", 0.65),
    },
    "open_redirect": {
        "default": ("open-redirect", "medium", 0.70),
    },
    "cache": {
        "default": ("information-leakage", "low", 0.50),
    },
    "security_headers": {
        "default": ("security-misconfiguration", "low", 0.55),
    },
}


@dataclass
class TriageResult:
    finding_id: str = ""
    module: str = ""
    verdict: str = ""              # confirmed|benign|inconclusive
    severity: str = "unknown"      # critical|high|medium|low|info
    owasp: str = ""
    confidence: float = 0.0
    reason: str = ""
    evidence_quote: str = ""
    source: str = "signature"      # signature|llm
    agent_a: str = ""
    agent_b: str = ""


def triage_static(finding: Finding | dict) -> TriageResult:
    """Static, signature-based triage using STATIC_RULES table."""
    if isinstance(finding, Finding):
        module = finding.module
        extra = finding.extra or {}
        fid = finding.id
    else:
        module = finding.get("module", "")
        extra = finding.get("extra", {}) or {}
        fid = finding.get("id", "")

    rules = STATIC_RULES.get(module, {})
    finding_type = extra.get("type", "default")
    owasp, severity, confidence = rules.get(finding_type, rules.get("default", ("unknown", "low", 0.5)))

    return TriageResult(
        finding_id=fid,
        module=module,
        verdict="confirmed" if confidence >= 0.7 else "inconclusive",
        severity=severity,
        owasp=owasp,
        confidence=confidence,
        reason=f"Signature-based triage for {module}/{finding_type}",
        evidence_quote=(finding.signal if isinstance(finding, Finding) else finding.get("signal", ""))[:200],
        source="signature",
    )


async def triage_llm(finding: Finding | dict, llm_client=None) -> TriageResult:
    """LLM-based debate triage. Falls back to static if no LLM available."""
    if llm_client is None:
        return triage_static(finding)

    if isinstance(finding, Finding):
        fid = finding.id
        module = finding.module
        signal = finding.signal or ""
        response = finding.response[:800] if finding.response else ""
    else:
        fid = finding.get("id", "")
        module = finding.get("module", "")
        signal = finding.get("signal", "") or ""
        response = finding.get("response", "")[:800] if finding.get("response") else ""

    prompt = f"""You are a web security triage expert conducting a two-agent debate and judicial synthesis. Analyze this scanner finding.

MODULE: {module}
SIGNAL: {signal}
RESPONSE: {response}

Return a JSON verdict:
{{"agent_a": "Argumenter: 2 sentences arguing why this finding is exploitable citing exact evidence",
 "agent_b": "Opposer: 2 sentences arguing potential false-positive constraints or mitigations",
 "verdict": "confirmed|benign|inconclusive",
 "severity": "critical|high|medium|low|info",
 "owasp_category": "owasp category",
 "confidence": 0.0-1.0,
 "reason": "Judge synthesis resolving Agent A and Agent B arguments"}}
"""
    try:
        try:
            text = await llm_client.acomplete(prompt, use_heavy=True)
        except TypeError:
            text = await llm_client.acomplete(prompt)
        json_match = re.search(r"\{.*\}", text, re.S)
        if json_match:
            data = json.loads(json_match.group())
            if isinstance(data, dict) and not data.get("mock"):
                base = triage_static(finding)
                raw_verdict = str(data.get("verdict", "")).lower().strip()
                verdict = raw_verdict if raw_verdict in ("confirmed", "benign", "rejected") else base.verdict
                raw_sev = str(data.get("severity", "")).lower().strip()
                severity = raw_sev if raw_sev in ("critical", "high", "medium", "low", "info") else base.severity
                owasp = data.get("owasp_category") or data.get("owasp") or base.owasp
                raw_conf = data.get("confidence", base.confidence)
                if isinstance(raw_conf, str):
                    conf_map = {"high": 0.9, "medium": 0.75, "low": 0.5}
                    confidence = conf_map.get(raw_conf.lower().strip(), base.confidence)
                else:
                    confidence = float(raw_conf)
                reason_txt = re.sub(r"^(?:judge\s*synthesis|judge|verdict)\s*:\s*", "", str(data.get("reason") or base.reason), flags=re.I).strip()
                agent_a_txt = re.sub(r"^(?:argumenter|agent\s*a)\s*:\s*", "", str(data.get("agent_a") or ""), flags=re.I).strip()
                agent_b_txt = re.sub(r"^(?:opposer|agent\s*b)\s*:\s*", "", str(data.get("agent_b") or ""), flags=re.I).strip()
                return TriageResult(
                    finding_id=fid, module=module,
                    verdict=verdict,
                    severity=severity,
                    owasp=owasp,
                    confidence=confidence,
                    reason=reason_txt,
                    evidence_quote=(data.get("evidence_quote") or signal)[:200],
                    source="llm",
                    agent_a=agent_a_txt,
                    agent_b=agent_b_txt,
                )
    except Exception:
        pass
    return triage_static(finding)

# --------------------------------------------------------------------------
# Debate triage API (with hard evidence enforcement)
# --------------------------------------------------------------------------

VALID_VERDICTS = {"confirmed", "rejected", "needs_more_evidence"}
VALID_SEVERITIES = {"Critical", "High", "Medium", "Low"}

JUDGE_PROMPT = (
    "You are the judge. Use ONLY the evidence given. Return JSON: "
    '{"verdict":"confirmed|rejected|needs_more_evidence",'
    '"severity":"Critical|High|Medium|Low","owasp":"","reason":"",'
    '"confidence":"low|medium|high","evidence_quote":""}. '
    "evidence_quote must be an exact substring copied from response_excerpt that "
    "proves the issue. If the output is HTML-escaped, or the response only echoes "
    "your input, verdict is rejected. Cookies that are not session/auth tokens are "
    "rejected. For session/cookie findings, owasp MUST be "
    "'A05:2021-Security Misconfiguration'."
)


def is_signal_in_response(signal: str, response: str) -> bool:
    """Check whether the claimed signal is actually substantiated in the response."""
    if not signal or not response:
        return False
    resp_lower = response.lower()
    sig_lower = signal.lower()

    # Specific signal families first, so loose quote matching cannot pre-empt them.
    if "sql error" in sig_lower:
        return any(err in resp_lower for err in
                   ["syntax error", "operationalerror", "sqlite", "mysql", "pg_query"])
    if "unescaped html marker" in sig_lower:
        return "nspmarker" in resp_lower
    if "session cookie" in sig_lower:
        return "set-cookie" in resp_lower
    if "sensitive authentication token" in sig_lower:
        return "token" in resp_lower or "session" in resp_lower
    if "boolean differential" in sig_lower:
        return len(response) > 0

    # Generic: quote-delimited fragments of >= 6 chars must appear in the response.
    quoted = re.findall(r"['\"]([^'\"]{6,})['\"]", signal)
    if quoted:
        return any(q.lower() in resp_lower for q in quoted)
    return False


def enforce(f: dict, v: dict) -> dict:
    """Hard evidence verification and domain rules applied to a verdict.

    1. Session/cookie findings always map to A05 misconfiguration.
    2. A confirmed verdict needs an evidence quote present in the response.
    3. XSS with HTML-escaped output is rejected.
    4. SQLi boolean-differential without a DB error is reflection, not injection.
    """
    from nikspider.stage2_spiderpois.modules.sqli import find_sql_error

    q = (v.get("evidence_quote") or "").strip()
    module = f.get("module", "")
    signal = f.get("signal", "")
    response = f.get("response", "")
    extra = f.get("extra", {})
    if isinstance(extra, str):
        try:
            extra = json.loads(extra)
        except Exception:
            extra = {}

    if module == "session" or "cookie" in signal.lower() or \
            "session_id" in str(f.get("param", "")):
        v["owasp"] = "A05:2021-Security Misconfiguration"

    is_boolean = "boolean differential" in signal.lower() or \
        extra.get("type") == "boolean-differential"

    if v.get("verdict") == "confirmed":
        if not q or q not in response:
            if not is_signal_in_response(signal, response):
                v.update(verdict="rejected",
                         reason="Evidence quote not found in response.")
        elif module == "xss" and re.search(
                r"&lt;|&#x3c;|&#x27;|&#39;|&quot;|&amp;", q, re.I):
            v.update(verdict="rejected", reason="Output is HTML-escaped.")
        elif module == "sqli" and is_boolean and not find_sql_error(response):
            v.update(verdict="rejected",
                     reason="Response only echoes input parameter "
                            "(reflection, not SQL logic).")

    if module == "sqli" and is_boolean and not find_sql_error(response):
        v.update(verdict="rejected",
                 reason="Response only echoes input parameter "
                        "(reflection, not SQL logic).")
    return v


async def debate_agent_a(f_dict: dict, cfg: dict | None = None, llm=None) -> str:
    """Agent A argues the finding is exploitable."""
    from nikspider.stage3_5_llm_gateway.llm_gateway import call_llm
    ev = {
        "module": f_dict.get("module", ""), "url": f_dict.get("url", ""),
        "param": f_dict.get("param", ""), "request": f_dict.get("request", ""),
        "response_excerpt": f_dict.get("response", "")[:1500],
        "signal": f_dict.get("signal", ""),
    }
    return await call_llm([
        {"role": "system",
         "content": "Agent A: argue this IS exploitable. Cite exact evidence. 4 sentences max."},
        {"role": "user", "content": json.dumps(ev)},
    ], json_mode=False, cfg=cfg)


async def debate_agent_b(f_dict: dict, cfg: dict | None = None, llm=None) -> str:
    """Agent B argues the finding is a false positive or mitigated."""
    from nikspider.stage3_5_llm_gateway.llm_gateway import call_llm
    ev = {
        "module": f_dict.get("module", ""), "url": f_dict.get("url", ""),
        "param": f_dict.get("param", ""), "request": f_dict.get("request", ""),
        "response_excerpt": f_dict.get("response", "")[:1500],
        "signal": f_dict.get("signal", ""),
    }
    return await call_llm([
        {"role": "system",
         "content": "Agent B: argue this is a FALSE POSITIVE (escaping, reflection "
                    "only, non-session cookie). Cite exact evidence. 4 sentences max."},
        {"role": "user", "content": json.dumps(ev)},
    ], json_mode=False, cfg=cfg)


async def judge_debate(f_dict: dict, agent_a_arg: str, agent_b_arg: str,
                       extra_evidence: str | None = None,
                       cfg: dict | None = None) -> dict:
    """Judge resolves the debate from evidence only."""
    from nikspider.stage3_5_llm_gateway.llm_gateway import call_llm
    ev = {
        "module": f_dict.get("module", ""), "url": f_dict.get("url", ""),
        "param": f_dict.get("param", ""), "request": f_dict.get("request", ""),
        "response_excerpt": f_dict.get("response", "")[:1500],
        "signal": f_dict.get("signal", ""),
    }
    payload = {"evidence": ev, "a": agent_a_arg, "b": agent_b_arg}
    if extra_evidence:
        payload["extra_evidence"] = extra_evidence
    res = await call_llm([
        {"role": "system", "content": JUDGE_PROMPT},
        {"role": "user", "content": json.dumps(payload)},
    ], json_mode=True, cfg=cfg, use_heavy=True)
    if isinstance(res, dict):
        return res
    raise ValueError("Judge did not return a valid JSON dictionary")




# Debate triage (two-agent + judge) lives in debate_triage.py to keep this
# module focused on signature-based triage. Re-exported for compatibility.
from nikspider.stage3_spiderweb.debate_triage import (  # noqa: E402,F401
    triage,
    triage_finding,
    triage_all_findings,
)
