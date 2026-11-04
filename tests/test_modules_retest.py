"""Tests for module retest() methods and planner."""
import pytest
from unittest.mock import AsyncMock, MagicMock
from nikspider.stage2_spiderpois.modules.sqli import SQLiModule, find_sql_error
from nikspider.stage2_spiderpois.modules.xss import XSSModule, XSS_MARKER_TAG
from nikspider.stage2_spiderpois.modules.session import SessionModule, is_session_cookie, parse_cookie_attributes
from nikspider.stage2_spiderpois.modules.access import AccessControlModule
from nikspider.stage2_spiderpois.planner import plan_scans, ALLOWED_CHECKS


def _mock_resp(status_code=200, text="", headers=None):
    r = MagicMock()
    r.status_code = status_code
    r.text = text
    r.headers = headers or {"content-type": "text/html"}
    return r


class TestFindSqlError:
    def test_detects_sqlite_error(self):
        assert find_sql_error("sqlite3.OperationalError: near \"'\"") is not None

    def test_detects_mysql_error(self):
        assert find_sql_error("You have an error in your SQL syntax") is not None

    def test_detects_postgres_error(self):
        assert find_sql_error("pg_query(): Query failed") is not None

    def test_clean_response_returns_none(self):
        assert find_sql_error("<html>All good</html>") is None


class TestSessionHelpers:
    def test_is_session_cookie_true(self):
        assert is_session_cookie("session_id")
        assert is_session_cookie("JSESSIONID")
        assert is_session_cookie("connect.sid")

    def test_is_session_cookie_false(self):
        assert not is_session_cookie("theme")
        assert not is_session_cookie("lang")
        assert not is_session_cookie("tracking_id")

    def test_parse_cookie_attributes(self):
        name, val, attrs = parse_cookie_attributes(
            "session_id=abc123; HttpOnly; Secure; SameSite=Lax"
        )
        assert name == "session_id"
        assert val == "abc123"
        assert "httponly" in attrs
        assert "secure" in attrs
        assert attrs["samesite"] == "Lax"

    def test_parse_cookie_no_attrs(self):
        name, val, attrs = parse_cookie_attributes("theme=dark")
        assert name == "theme"
        assert val == "dark"
        assert attrs == {}


class TestSQLiRetest:
    @pytest.mark.asyncio
    async def test_retest_fixed_when_no_error(self):
        client = AsyncMock()
        client.get.return_value = _mock_resp(200, "<html>No results</html>")
        finding = {
            "url": "http://a.com/search?q=test",
            "param": "q",
            "extra": {"method": "GET", "type": "error-based"},
        }
        assert await SQLiModule().retest(finding, client) is True

    @pytest.mark.asyncio
    async def test_retest_still_vulnerable_when_error(self):
        client = AsyncMock()
        client.get.return_value = _mock_resp(500, "syntax error near SELECT")
        finding = {
            "url": "http://a.com/search?q=test",
            "param": "q",
            "extra": {"method": "GET", "type": "error-based"},
        }
        assert await SQLiModule().retest(finding, client) is False

    @pytest.mark.asyncio
    async def test_retest_returns_true_on_network_error(self):
        client = AsyncMock()
        client.get.side_effect = Exception("connection refused")
        finding = {
            "url": "http://a.com/search?q=test",
            "param": "q",
            "extra": {"method": "GET", "type": "error-based"},
        }
        assert await SQLiModule().retest(finding, client) is True


class TestXSSRetest:
    @pytest.mark.asyncio
    async def test_retest_fixed_when_escaped(self):
        client = AsyncMock()
        client.get.return_value = _mock_resp(200, "<div>&lt;nspmarker&gt;</div>")
        finding = {"url": "http://a.com/p?name=x", "param": "name", "extra": {"method": "GET"}}
        assert await XSSModule().retest(finding, client) is True

    @pytest.mark.asyncio
    async def test_retest_vulnerable_when_reflected(self):
        client = AsyncMock()
        client.get.return_value = _mock_resp(200, f"<div>{XSS_MARKER_TAG}</div>")
        finding = {"url": "http://a.com/p?name=x", "param": "name", "extra": {"method": "GET"}}
        assert await XSSModule().retest(finding, client) is False


class TestSessionRetest:
    @pytest.mark.asyncio
    async def test_retest_fixed_when_flags_present(self):
        client = AsyncMock()
        client.get.return_value = _mock_resp(
            200, "<html/>",
            {"content-type": "text/html",
             "set-cookie": "session_id=abc; HttpOnly; Secure; SameSite=Lax"}
        )
        finding = {"url": "http://a.com/login", "param": "session_id", "extra": {}}
        assert await SessionModule().retest(finding, client) is True

    @pytest.mark.asyncio
    async def test_retest_vulnerable_when_flags_missing(self):
        client = AsyncMock()
        client.get.return_value = _mock_resp(
            200, "<html/>",
            {"content-type": "text/html", "set-cookie": "session_id=abc"}
        )
        finding = {"url": "http://a.com/login", "param": "session_id", "extra": {}}
        assert await SessionModule().retest(finding, client) is False

    @pytest.mark.asyncio
    async def test_retest_token_in_url_removed(self):
        client = AsyncMock()
        finding = {
            "url": "http://a.com/callback",
            "param": "access_token",
            "extra": {"type": "token_in_url"},
        }
        assert await SessionModule().retest(finding, client) is True


class TestAccessRetest:
    @pytest.mark.asyncio
    async def test_retest_fixed_on_403(self):
        client = AsyncMock()
        client.get.return_value = _mock_resp(403, "Forbidden")
        finding = {"url": "http://a.com/api/users/2", "extra": {}}
        assert await AccessControlModule().retest(finding, client) is True

    @pytest.mark.asyncio
    async def test_retest_vulnerable_on_200_with_content(self):
        client = AsyncMock()
        client.get.return_value = _mock_resp(200, "user data here " * 20)
        finding = {"url": "http://a.com/api/users/2", "extra": {}}
        assert await AccessControlModule().retest(finding, client) is False


class TestPlanner:
    def test_access_is_allowed_check(self):
        assert "access" in ALLOWED_CHECKS
        # Base four modules are always allowed
        assert {"sqli", "xss", "session", "access"} <= ALLOWED_CHECKS

    @pytest.mark.asyncio
    async def test_fallback_plan_includes_checks(self):
        crawl_map = [
            {"url": "http://a.com/search?q=1", "query_params": ["q"], "forms": [], "set_cookies": []},
        ]
        plan = await plan_scans(crawl_map)  # no llm → deterministic fallback

        assert len(plan) == 1
        assert "sqli" in plan[0]["checks"]
        assert "xss" in plan[0]["checks"]

    @pytest.mark.asyncio
    async def test_fallback_plan_filters_unknown_checks(self):
        import json
        crawl_map = [{"url": "http://a.com/", "query_params": [], "forms": [], "set_cookies": []}]
        llm_out = json.dumps([{"url": "http://a.com/", "checks": ["sqli", "bogus_check"], "why": "test"}])
        mock_llm = AsyncMock()
        mock_llm.available = True
        mock_llm.acomplete = AsyncMock(return_value=llm_out)
        plan = await plan_scans(crawl_map, llm=mock_llm)

        assert len(plan) == 1
        assert "bogus_check" not in plan[0]["checks"]
        assert "sqli" in plan[0]["checks"]