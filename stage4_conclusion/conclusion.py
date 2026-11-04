"""Conclusion synthesizer — aggregates triaged findings into a risk summary.

Determines overall risk score, top risks by module/severity, and severity histogram.
"""

from collections import Counter
from dataclasses import dataclass, field
from typing import Any

from nikspider.common.models import Finding
from nikspider.stage3_spiderweb.triage import TriageResult


SEVERITY_WEIGHTS = {
    "critical": 25,
    "high": 15,
    "medium": 7,
    "low": 2,
    "info": 1,
}


@dataclass
class RiskSummary:
    total_findings: int = 0
    risk_score: int = 0
    severity_counts: dict[str, int] = field(default_factory=dict)
    top_risks: list[dict] = field(default_factory=list)
    by_module: dict[str, int] = field(default_factory=dict)
    owasp_categories: dict[str, int] = field(default_factory=dict)
    triage_summary: str = ""


def calculate_risk_score(
    triaged: list[TriageResult],
    findings: list[Finding] | None = None,
) -> RiskSummary:
    """Compute risk summary from triaged findings."""
    summary = RiskSummary()
    severity_counter: Counter[str] = Counter()
    module_counter: Counter[str] = Counter()
    owasp_counter: Counter[str] = Counter()
    risks: list[tuple[int, dict]] = []

    for i, tr in enumerate(triaged):
        severity_counter[tr.severity] += 1
        module_counter[tr.module] += 1
        if tr.owasp:
            owasp_counter[tr.owasp] += 1
        weight = SEVERITY_WEIGHTS.get(tr.severity, 1)
        summary.risk_score += weight
        risks.append((weight, {
            "module": tr.module,
            "severity": tr.severity,
            "owasp": tr.owasp,
            "confidence": tr.confidence,
            "reason": tr.reason,
            "evidence": tr.evidence_quote,
        }))

    # Top risks sorted by severity weight
    risks.sort(key=lambda x: -x[0])
    summary.top_risks = [r[1] for r in risks[:10]]
    summary.severity_counts = dict(severity_counter)
    summary.by_module = dict(module_counter)
    summary.owasp_categories = dict(owasp_counter)
    summary.total_findings = len(triaged)

    if summary.total_findings > 0:
        critical = severity_counter.get("critical", 0)
        high = severity_counter.get("high", 0)
        summary.triage_summary = (
            f"{summary.total_findings} findings: "
            f"{critical} critical, {high} high, "
            f"{severity_counter.get('medium', 0)} medium, "
            f"{severity_counter.get('low', 0)} low"
        )

    return summary