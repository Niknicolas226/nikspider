import pytest
import os
from unittest.mock import AsyncMock, MagicMock, patch
from nikspider.stage0_intake_guard.guard import is_public_host, is_allowed_target
from nikspider.stage0_intake_guard.verify import new_token, verify_file
from nikspider.stage3_5_llm_gateway.llm_gateway import call_llm
from nikspider.stage1_spidereyes.crawler import Crawler

def test_guard_private_ips():
    # Private and loopback IPs should fail
    assert not is_public_host("http://127.0.0.1:8000")
    assert not is_public_host("http://192.168.1.50")
    assert not is_public_host("http://10.0.0.1")
    assert not is_public_host("http://172.16.0.5")

def test_guard_demo_hosts():
    # With demo_allow, localhost is accepted
    assert is_public_host("http://localhost:3000", demo_allow={"localhost"})
    assert is_public_host("http://127.0.0.1:3000", demo_allow={"127.0.0.1"})

def test_guard_allowed_target_env(monkeypatch):
    monkeypatch.setenv("DEMO_MODE", "0")
    assert not is_allowed_target("http://localhost:3000")

    monkeypatch.setenv("DEMO_MODE", "1")
    assert is_allowed_target("http://localhost:3000")
    assert is_allowed_target("http://127.0.0.1:3000")

def test_verify_new_token():
    tok = new_token()
    assert tok.startswith("nikspider-verify=")
    assert len(tok) > 20

@pytest.mark.asyncio
async def test_verify_file():
    token = new_token()
    mock_client = AsyncMock()

    # Success case
    mock_resp_success = MagicMock(status_code=200, text=f"prefix {token} suffix")
    mock_client.get.return_value = mock_resp_success
    assert await verify_file("https://example.com", token, client=mock_client)

    # Wrong token case
    mock_resp_wrong = MagicMock(status_code=200, text="other content")
    mock_client.get.return_value = mock_resp_wrong
    assert not await verify_file("https://example.com", token, client=mock_client)

    # 404 case
    mock_resp_404 = MagicMock(status_code=404, text="Not Found")
    mock_client.get.return_value = mock_resp_404
    assert not await verify_file("https://example.com", token, client=mock_client)

@pytest.mark.asyncio
async def test_call_llm_mock_fallback():
    # Without API key or with mock key, should return structured mock output
    res = await call_llm([{"role": "user", "content": "hello"}], json_mode=True, cfg={"api_key": ""})
    assert res.get("mock") is True

    text_res = await call_llm([{"role": "user", "content": "hello"}], json_mode=False, cfg={"api_key": ""})
    assert "Mock LLM" in text_res

@pytest.mark.asyncio
async def test_crawler_parsing():
    html_content = """
    <!DOCTYPE html>
    <html>
      <head>
        <script src="/js/app.js"></script>
        <script src="https://cdn.example.com/ext.js"></script>
      </head>
      <body>
        <form action="/login" method="POST">
          <input name="email" type="text" />
          <input name="password" type="password" />
        </form>
        <a href="/about">About Us</a>
        <a href="https://external.com/page">External</a>
      </body>
    </html>
    """
    mock_client = AsyncMock()
    headers_dict = {"content-type": "text/html; charset=utf-8", "set-cookie": "session_id=123; HttpOnly"}
    mock_response = MagicMock(
        status_code=200,
        headers=headers_dict,
        text=html_content
    )
    mock_client.get.return_value = mock_response

    crawler = Crawler(start_url="http://localhost:3000", max_pages=5, delay=0, client=mock_client)
    pages = await crawler.crawl()

    assert len(pages) > 0
    first_page = pages[0]
    assert first_page["status"] == 200
    assert len(first_page["forms"]) == 1
    assert first_page["forms"][0]["inputs"] == ["email", "password"]
    assert any("/js/app.js" in s for s in first_page["scripts"])
    assert "http://localhost:3000/about" in first_page["links"]
