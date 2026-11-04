"""Tests for triage module: evidence enforcement, debate flow, verdict validation."""
import pytest
from unittest.mock import AsyncMock, patch
from nikspider.stage3_spiderweb.triage import (
    enforce,
    is_signal_in_response,
    triage,
    triage_all_findings,
    VALID_VERDICTS,
    VALID_SEVERITIES,
)
from nikspider.stage2_spiderpois.modules.base import Finding


class TestIsSignalInResponse:
    def test_sql_error_signal_found(self):
        assert is_signal_in_response(
            "SQL error pattern: 'syntax error'",
            "Database error: syntax error near SELECT"
        )

    def test_sql_error_not_found(self):
        assert not is_signal_in_response(
            "SQL error pattern: 'syntax error'",
            "No results found."
        )

    def test_xss_marker_found(self):
        assert is_signal_in_response(
            "Unescaped HTML marker tag reflected: '<nspmarker id=\"z\">'",
            "<div><nspmarker id=\"z\">hello</div>"
        )

    def test_xss_marker_not_found(self):
        assert not is_signal_in_response(
            "Unescaped HTML marker tag reflected: '<nspmarker id=\"z\">'",
            "<div>hello</div>"
        )

    def test_session_cookie_found(self):
        assert is_signal_in_response(
            "Session cookie 'session_id' missing flags",
            "Set-Cookie: session_id=abc123"
        )

    def test_empty_signal_or_response(self):
        assert not is_signal_in_response("", "some response")
        assert not is_signal_in_response("some signal", "")


class TestEnforce:
    def test_confirmed_rejected_when_evidence_quote_missing(self):
        f = {"module": "sqli", "signal": "error", "response": "syntax error: boom"}
        v = {"verdict": "confirmed", "evidence_quote": "nonexistent text"}
        result = enforce(f, v)
        assert result["verdict"] == "rejected"

    def test_confirmed_rejected_for_html_escaped_xss(self):
        f = {"module": "xss", "signal": "marker", "response": "&lt;nspmarker&gt;"}
        v = {"verdict": "confirmed", "evidence_quote": "&lt;nspmarker&gt;"}
        result = enforce(f, v)
        assert result["verdict"] == "rejected"

    def test_session_module_maps_to_a05(self):
        f = {"module": "session", "signal": "cookie", "response": "Set-Cookie: session_id=123", "extra": {}}
        v = {"verdict": "rejected", "evidence_quote": ""}
        result = enforce(f, v)
        assert result["owasp"] == "A05:2021-Security Misconfiguration"

    def test_preserves_valid_confirmed(self):
        response_text = "syntax error near SELECT"
        f = {"module": "sqli", "signal": "SQL error", "response": response_text, "extra": {}}
        v = {"verdict": "confirmed", "evidence_quote": "syntax error near SELECT", "severity": "High"}
        result = enforce(f, v)
        assert result["verdict"] == "confirmed"

    def test_search_safe_decoy_rejected(self):
        f = {
            "module": "sqli",
            "url": "http://localhost:5000/search_safe?query=Widget",
            "param": "query",
            "signal": "Consistent boolean differential response",
            "response": "<!DOCTYPE html><html><body><h3>Safe Search:</h3><p>Results for: test&#x27; OR &#x27;1&#x27;=&#x27;1</p></body></html>",
            "extra": {"type": "boolean-differential"},
        }
        v = {"verdict": "confirmed", "evidence_quote": "test&#x27; OR &#x27;1&#x27;=&#x27;1", "severity": "High"}
        result = enforce(f, v)
        assert result["verdict"] == "rejected"

    def test_profile_boolean_diff_rejected(self):
        f = {
            "module": "sqli",
            "url": "http://localhost:5000/profile?name=Guest",
            "param": "name",
            "signal": "Consistent boolean differential response",
            "response": "<!DOCTYPE html><html><body><h1>User Profile: test' OR '1'='1</h1></body></html>",
            "extra": {"type": "boolean-differential"},
        }
        v = {"verdict": "confirmed", "evidence_quote": "test' OR '1'='1", "severity": "High"}
        result = enforce(f, v)
        assert result["verdict"] == "rejected"


class TestTriage:
    @pytest.mark.asyncio
    async def test_triage_mock_fallback_on_llm_failure(self):
        """When LLM is unavailable, triage returns needs_more_evidence, never confirmed."""
        finding = Finding(
            scan_id="test",
            module="sqli",
            url="http://example.com/search",
            param="q",
            signal="SQL error",
            response="syntax error"
        )
        with patch("nikspider.stage3_5_llm_gateway.llm_gateway.call_llm", side_effect=Exception("LLM down")):
            result = await triage(finding)
            assert result["verdict"] == "needs_more_evidence"
            assert result["source"] == "fallback"

    @pytest.mark.asyncio
    async def test_triage_session_gets_a05_owasp(self):
        finding = Finding(
            scan_id="test",
            module="session",
            url="http://example.com/login",
            param="session_id",
            signal="missing flags",
            response="Set-Cookie: session_id=abc"
        )
        with patch("nikspider.stage3_5_llm_gateway.llm_gateway.call_llm", side_effect=Exception("no llm")):
            result = await triage(finding)
            assert "A05:2021" in result["owasp"]

    @pytest.mark.asyncio
    async def test_triage_all_findings_empty(self):
        results = await triage_all_findings([])
        assert results == []

    @pytest.mark.asyncio
    async def test_triage_all_findings_runs_parallel(self):
        f1 = Finding(module="sqli", url="http://a.com", signal="err", response="err")
        f2 = Finding(module="xss", url="http://b.com", signal="marker", response="marker")
        with patch("nikspider.stage3_5_llm_gateway.llm_gateway.call_llm", side_effect=Exception("mock")):
            results = await triage_all_findings([f1, f2])
            assert len(results) == 2
            for r in results:
                assert "verdict" in r