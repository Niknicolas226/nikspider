"""Remediation research — one fix prompt per confirmed finding.

Combines tool registry lookup with optional LLM grounding.
"""

from typing import Any

from nikspider.stage3_spiderweb.triage import TriageResult
from nikspider.stage3_5_llm_gateway.grounding import search_remediation, lookup_tool_registry


async def generate_fix_prompt(
    triage_result: TriageResult,
    signal: str = "",
    llm_gateway=None,
) -> dict:
    """Generate a remediation fix prompt for a confirmed finding.

    Returns a dict with:
      - fix: actionable code-level fix
      - owasp_ref: link to OWASP reference
      - snippet: short code example
    """
    registry = lookup_tool_registry(triage_result.module) or {}

    fix_text = registry.get("fix", "")
    owasp_ref = registry.get("owasp_ref", "")
    snippet = registry.get("code_example", "")

    if llm_gateway and llm_gateway.available:
        additional = await search_remediation(triage_result.module, signal, llm_gateway)
        if additional and "No remediation" not in additional:
            fix_text = additional

    return {
        "module": triage_result.module,
        "severity": triage_result.severity,
        "owasp": triage_result.owasp,
        "fix": fix_text,
        "owasp_ref": owasp_ref,
        "snippet": snippet,
        "signal": signal,
    }


async def generate_all_fix_prompts(
    triaged: list[TriageResult],
    findings: list[dict],
    llm_gateway=None,
) -> list[dict]:
    """Generate fix prompts for all confirmed findings (caching LLM remediation per module)."""
    import asyncio

    confirmed = [tr for tr in triaged if tr.verdict == "confirmed"]
    if not confirmed:
        return []

    signal_by_id = {f.get("id"): (f.get("signal", "") or "") for f in findings}
    unique_by_mod: dict[str, tuple[TriageResult, str]] = {}
    for tr in confirmed:
        if tr.module not in unique_by_mod:
            unique_by_mod[tr.module] = (tr, signal_by_id.get(tr.finding_id, ""))

    mod_keys = list(unique_by_mod.keys())
    mod_results = await asyncio.gather(
        *(
            generate_fix_prompt(unique_by_mod[m][0], unique_by_mod[m][1], llm_gateway)
            for m in mod_keys
        )
    )
    mod_cache = dict(zip(mod_keys, mod_results))

    prompts = []
    for tr in confirmed:
        base_prompt = dict(mod_cache[tr.module])
        base_prompt["severity"] = tr.severity
        base_prompt["owasp"] = tr.owasp
        base_prompt["signal"] = signal_by_id.get(tr.finding_id, "")
        prompts.append(base_prompt)
    return prompts