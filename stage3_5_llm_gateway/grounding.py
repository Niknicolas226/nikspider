"""Grounding — web-search for remediation snippets + tool registry lookup.

Falls back to the static tool_registry.yaml when search is unavailable.
"""

import os
import yaml
from pathlib import Path

CONFIG_DIR = Path(__file__).resolve().parents[2] / "config"
TOOL_REGISTRY_PATH = CONFIG_DIR / "tool_registry.yaml"


def _load_registry() -> dict:
    if TOOL_REGISTRY_PATH.exists():
        with open(TOOL_REGISTRY_PATH) as f:
            return yaml.safe_load(f) or {}
    return {}


def lookup_tool_registry(module: str) -> dict | None:
    """Look up standard remediation advice for a given module."""
    return _load_registry().get(module)


async def search_remediation(module: str, signal: str, llm_gateway=None) -> str:
    """Search for remediation advice — web search via LLM grounding or registry fallback.

    Uses LLM to synthesize advice from the static registry + its training data.
    """
    registry = lookup_tool_registry(module) or {}

    if llm_gateway and llm_gateway.available:
        prompt = f"""You are an application security remediation expert.

An automated scanner found a {module} vulnerability with this signal:
"{signal}"

Based on this OWASP guidance: {registry.get('owasp_ref', 'OWASP Top 10')}
Provide a concise, actionable fix in 2-3 sentences.
Focus on the specific code pattern, not generic advice."""
        result = await llm_gateway.complete(prompt, system="You are a security remediation expert. Be concise and specific.", max_tokens=500)
        if result.strip():
            return result

    # Fallback to registry
    if registry:
        return f"{registry.get('fix', 'No fix available')}\n{registry.get('owasp_ref', '')}"
    return "No remediation advice available for this module."


def ensure_grounded_arguments(
    arguments: dict[str, str],
    evidence_id: str,
    valid_evidence_ids: set[str] | None = None,
) -> dict[str, str]:
    """Validate and ground Stage 4 argument blocks (severity_case, mitigating_factors, neutral_summary).

    Strips sentences that reference hallucinated evidence IDs not in valid_evidence_ids,
    and ensures each non-empty section carries a clickable [evidence_id: <id>] citation.
    """
    import re

    allowed = set(valid_evidence_ids or set())
    allowed.add(evidence_id)
    citation_tag = f"[evidence_id: {evidence_id}]"
    out: dict[str, str] = {}

    for key in ("severity_case", "mitigating_factors", "neutral_summary"):
        raw_text = (arguments.get(key) or "").strip()
        if not raw_text:
            out[key] = ""
            continue

        # Split into sentences and strip any sentence citing an unknown evidence_id
        sentences = re.split(r"(?<=[.!?])\s+", raw_text)
        kept: list[str] = []
        for s in sentences:
            cited = re.findall(r"\[evidence_id:\s*([a-zA-Z0-9_-]+)\]", s)
            if cited and any(cid not in allowed for cid in cited):
                continue
            kept.append(s)

        cleaned = " ".join(kept).strip()
        if cleaned and "[evidence_id:" not in cleaned:
            cleaned = f"{cleaned.rstrip('.')} {citation_tag}."
        out[key] = cleaned

    return out
