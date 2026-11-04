"""Tests for roadmap generation: risk scoring, severity ordering, fallback grouping."""
import pytest
from unittest.mock import patch
from nikspider.stage5_report.roadmap import (
    calculate_risk_score,
    generate_roadmap,
    SEVERITY_WEIGHTS,
    SEVERITY_ORDER,
)
from nikspider.stage2_spiderpois.modules.base import Finding


class TestCalculateRiskScore:
    def test_empty_nodes(self):
        assert calculate_risk_score([]) == 0

    def test_single_critical(self):
        nodes = [{"severity": "Critical", "status": "open"}]
        assert calculate_risk_score(nodes) == 25

    def test_fixed_nodes_ignored(self):
        nodes = [
            {"severity": "Critical", "status": "fixed"},
            {"severity": "High", "status": "open"},
        ]
        assert calculate_risk_score(nodes) == 15

    def test_score_capped_at_100(self):
        nodes = [{"severity": "Critical", "status": "open"} for _ in range(10)]
        assert calculate_risk_score(nodes) == 100

    def test_unknown_severity_uses_default(self):
        nodes = [{"severity": "Unknown", "status": "open"}]
        assert calculate_risk_score(nodes) == 5

    def test_mixed_severities(self):
        nodes = [
            {"severity": "Critical", "status": "open"},
            {"severity": "High", "status": "open"},
            {"severity": "Medium", "status": "open"},
            {"severity": "Low", "status": "open"},
        ]
        assert calculate_risk_score(nodes) == 25 + 15 + 8 + 3


class TestGenerateRoadmap:
    @pytest.mark.asyncio
    async def test_empty_findings_returns_empty(self):
        nodes, score = await generate_roadmap([], {})
        assert nodes == []
        assert score == 0

    @pytest.mark.asyncio
    async def test_fallback_groups_by_module(self):
        findings = [
            Finding(id="f1", module="sqli", url="http://a.com/search", param="q", signal="err"),
            Finding(id="f2", module="sqli", url="http://a.com/find", param="q", signal="err"),
            Finding(id="f3", module="xss", url="http://a.com/profile", param="name", signal="marker"),
        ]
        triage_map = {
            "f1": {"severity": "High", "owasp": "A03:2021-Injection"},
            "f2": {"severity": "High", "owasp": "A03:2021-Injection"},
            "f3": {"severity": "Medium", "owasp": "A03:2021-Injection"},
        }
        with patch("backend.roadmap.call_llm", side_effect=Exception("no llm")):
            nodes, score = await generate_roadmap(findings, triage_map)

        assert len(nodes) == 2  # sqli group + xss group
        sqli_node = next(n for n in nodes if "sqli" in n["id"] or "Database" in n["issue"])
        assert len(sqli_node["finding_ids"]) == 2
        assert score > 0

    @pytest.mark.asyncio
    async def test_session_fallback_uses_a05(self):
        findings = [Finding(id="f1", module="session", url="http://a.com/login", param="session_id", signal="flags")]
        triage_map = {"f1": {"severity": "Medium", "owasp": "A05:2021-Security Misconfiguration"}}
        with patch("backend.roadmap.call_llm", side_effect=Exception("no llm")):
            nodes, _ = await generate_roadmap(findings, triage_map)

        assert len(nodes) == 1
        assert nodes[0]["owasp"] == "A05:2021-Security Misconfiguration"

    @pytest.mark.asyncio
    async def test_access_fallback_uses_a01(self):
        findings = [Finding(id="f1", module="access", url="http://a.com/api/users/1", param="1", signal="idor")]
        triage_map = {"f1": {"severity": "High", "owasp": "A01:2021-Broken Access Control"}}
        with patch("backend.roadmap.call_llm", side_effect=Exception("no llm")):
            nodes, _ = await generate_roadmap(findings, triage_map)

        assert len(nodes) == 1
        assert nodes[0]["owasp"] == "A01:2021-Broken Access Control"

    @pytest.mark.asyncio
    async def test_nodes_sorted_by_severity(self):
        findings = [
            Finding(id="f1", module="xss", url="http://a.com/p", param="n", signal="m"),
            Finding(id="f2", module="sqli", url="http://a.com/s", param="q", signal="e"),
        ]
        triage_map = {
            "f1": {"severity": "Medium", "owasp": "A03:2021-Injection"},
            "f2": {"severity": "High", "owasp": "A03:2021-Injection"},
        }
        with patch("backend.roadmap.call_llm", side_effect=Exception("no llm")):
            nodes, _ = await generate_roadmap(findings, triage_map)

        severities = [n["severity"] for n in nodes]
        assert severities == sorted(severities, key=lambda s: SEVERITY_ORDER.get(s, 99))

    @pytest.mark.asyncio
    async def test_llm_nodes_validated(self):
        findings = [Finding(id="f1", module="sqli", url="http://a.com/s", param="q", signal="e")]
        triage_map = {"f1": {"severity": "High", "owasp": "A03:2021-Injection"}}
        llm_output = [{
            "id": "node-1",
            "issue": "SQL Injection",
            "severity": "High",
            "owasp": "A03:2021-Injection",
            "root_cause": "String concat",
            "affects": ["/s"],
            "fix_steps": ["Use params"],
            "code_example": "cursor.execute('... ?', (q,))",
            "verify": "probe",
            "finding_ids": ["f1", "bogus-id"],
        }]
        with patch("backend.roadmap.call_llm", return_value=llm_output):
            nodes, _ = await generate_roadmap(findings, triage_map)

        assert len(nodes) == 1
        # bogus-id must be filtered out
        assert nodes[0]["finding_ids"] == ["f1"]
        assert nodes[0]["resolves_count"] == 1

class TestInferFindingIds:
    def test_infers_sqli_node(self):
        from nikspider.stage5_report.roadmap import _infer_finding_ids
        findings = [
            Finding(id="f1", module="sqli", url="http://a.com/search", param="q"),
            Finding(id="f2", module="xss", url="http://a.com/profile", param="name"),
        ]
        node = {"issue": "SQL Injection in query handler", "root_cause": "database query concat", "affects": ["/search"]}
        ids = _infer_finding_ids(node, findings)
        assert ids == ["f1"]

    def test_infers_xss_node(self):
        from nikspider.stage5_report.roadmap import _infer_finding_ids
        findings = [
            Finding(id="f1", module="sqli", url="http://a.com/search", param="q"),
            Finding(id="f2", module="xss", url="http://a.com/profile", param="name"),
        ]
        node = {"issue": "Reflected XSS in profile", "root_cause": "unescaped html output", "affects": ["/profile"]}
        ids = _infer_finding_ids(node, findings)
        assert ids == ["f2"]

    def test_fallback_returns_first_when_no_match(self):
        from nikspider.stage5_report.roadmap import _infer_finding_ids
        findings = [Finding(id="f1", module="sqli", url="http://a.com/x", param="q")]
        node = {"issue": "Totally unrelated wording", "root_cause": "zzz", "affects": []}
        ids = _infer_finding_ids(node, findings)
        assert ids == ["f1"]
