import pytest
from unittest.mock import AsyncMock, MagicMock
from nikspider.stage0_intake_guard.verify import new_token, verify_file

def test_token_format():
    tok = new_token()
    assert tok.startswith("nikspider-verify=")
    assert len(tok) >= 25

@pytest.mark.asyncio
async def test_verify_file_matches():
    tok = new_token()
    mock_client = AsyncMock()

    # Success case: returns 200 and token in text
    mock_resp_ok = MagicMock(status_code=200, text=f"header\n{tok}\nfooter")
    mock_client.get.return_value = mock_resp_ok
    assert await verify_file("https://example.com", tok, client=mock_client)

    # Mismatch case
    mock_resp_bad = MagicMock(status_code=200, text="other-token-here")
    mock_client.get.return_value = mock_resp_bad
    assert not await verify_file("https://example.com", tok, client=mock_client)

    # 404 case
    mock_resp_404 = MagicMock(status_code=404, text="Not Found")
    mock_client.get.return_value = mock_resp_404
    assert not await verify_file("https://example.com", tok, client=mock_client)

