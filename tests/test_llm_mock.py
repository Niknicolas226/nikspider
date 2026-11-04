"""Regression tests for mock LLM mode: role detection must inspect all messages,
and the judge must not reject real findings as decoys."""
import pytest
from nikspider.stage3_5_llm_gateway.llm_gateway import _get_mock_response, call_llm


PLANNER_SYS = {"role": "system", "content": "You are a precise security test planning agent. Return valid JSON only."}
PLANNER_USER = {"role": "user", "content": "You are the NikSpider Security Test Planner. Allowed checks are [...] Crawl Map: [{'url': 'http://t.com/search?q=1'}]"}
AGENT_A_SYS = {"role": "system", "content": "Agent A: argue this IS exploitable. Cite exact evidence. 4 sentences max."}
AGENT_B_SYS = {"role": "system", "content": "Agent B: argue this is a FALSE POSITIVE. Cite exact evidence."}
JUDGE_SYS = {"role": "system", "content": "You are the judge. Use ONLY the evidence given. Return JSON: ..."}
JUDGE_USER = {"role": "user", "content": '{"evidence": {"module": "sqli", "signal": "SQL error pattern: syntax error"}, "a": "arg", "b": "arg"}'}


class TestMockRoleDetection:
    def test_planner_detected_via_system_prompt(self):
        res = _get_mock_response([PLANNER_SYS, PLANNER_USER], json_mode=True)
        assert isinstance(res, list)
        assert res[0]["url"].startswith("http://")

    def test_planner_skips_non_http_placeholder(self):
        res = _get_mock_response([PLANNER_SYS, PLANNER_USER], json_mode=True)
        assert all(u["url"].lower().startswith("http") for u in res)

    def test_agent_a_returns_string_not_dict(self):
        res = _get_mock_response([AGENT_A_SYS, {"role": "user", "content": "{}"}], json_mode=False)
        assert isinstance(res, str)
        assert "exploitable" in res.lower()

    def test_agent_b_returns_string(self):
        res = _get_mock_response([AGENT_B_SYS, {"role": "user", "content": "{}"}], json_mode=False)
        assert isinstance(res, str)

    def test_judge_confirms_real_finding(self):
        res = _get_mock_response([JUDGE_SYS, JUDGE_USER], json_mode=True)
        assert res["verdict"] == "confirmed"

    def test_judge_rejects_search_safe_decoy(self):
        user = {"role": "user", "content": '{"evidence": {"url": "http://t.com/search_safe?query=x"}}'}
        res = _get_mock_response([JUDGE_SYS, user], json_mode=True)
        assert res["verdict"] == "rejected"

    def test_judge_session_maps_to_a05(self):
        user = {"role": "user", "content": '{"evidence": {"module": "session", "signal": "Session cookie missing flags"}}'}
        res = _get_mock_response([JUDGE_SYS, user], json_mode=True)
        assert res["verdict"] == "confirmed"
        assert "A05" in res["owasp"]

    def test_judge_not_fooled_by_benign_word_in_debate(self):
        # The word "benign" appears in debate text but must NOT trigger decoy rejection.
        user = {"role": "user", "content": '{"a": "a benign probe was used", "b": "benign configuration"}'}
        res = _get_mock_response([JUDGE_SYS, user], json_mode=True)
        assert res["verdict"] == "confirmed"


class TestCallLlmMockPath:
    @pytest.mark.asyncio
    async def test_no_api_key_uses_mock(self):
        res = await call_llm([PLANNER_SYS, PLANNER_USER], json_mode=True, cfg={"api_key": ""})
        assert isinstance(res, list)

    @pytest.mark.asyncio
    async def test_mock_key_uses_mock(self):
        res = await call_llm([JUDGE_SYS, JUDGE_USER], json_mode=True, cfg={"api_key": "mock"})
        assert res["verdict"] == "confirmed"