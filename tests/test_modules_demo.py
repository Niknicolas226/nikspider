import os
import threading
import time
import pytest
import httpx
from werkzeug.serving import make_server
from nikspider.stage2_spiderpois.modules.sqli import SQLiModule
from nikspider.stage2_spiderpois.modules.xss import XSSModule
from nikspider.stage2_spiderpois.modules.session import SessionModule
import demo_app.app as demo_pkg

class ServerThread(threading.Thread):
    def __init__(self, app, port=5099):
        threading.Thread.__init__(self, daemon=True)
        self.server = make_server("127.0.0.1", port, app)
        self.port = port

    def run(self):
        self.server.serve_forever()

    def shutdown(self):
        self.server.shutdown()

@pytest.fixture(scope="module")
def demo_server():
    os.environ["DEMO_MODE"] = "1"
    server = ServerThread(demo_pkg.app, port=5099)
    server.start()
    time.sleep(0.5)
    yield f"http://127.0.0.1:5099"
    server.shutdown()

@pytest.mark.asyncio
async def test_sqli_module_fixed_flow(demo_server):
    base_url = demo_server
    page = {
        "url": f"{base_url}/search?q=Widget",
        "query_params": ["q"],
        "forms": [],
        "set_cookies": []
    }
    sqli_mod = SQLiModule()

    async with httpx.AsyncClient() as client:
        # 1. FIXED = False -> Bug discovered
        demo_pkg.FIXED = False
        findings = await sqli_mod.run(page, client, scan_id="test_sqli")
        assert len(findings) > 0
        finding = findings[0]
        assert "syntax error" in finding.signal.lower()

        # 2. FIXED = True -> Retest passes
        demo_pkg.FIXED = True
        retest_passed = await sqli_mod.retest(finding, client)
        assert retest_passed is True

@pytest.mark.asyncio
async def test_xss_module_fixed_flow(demo_server):
    base_url = demo_server
    page = {
        "url": f"{base_url}/profile?name=Guest",
        "query_params": ["name"],
        "forms": [],
        "set_cookies": []
    }
    xss_mod = XSSModule()

    async with httpx.AsyncClient() as client:
        # 1. FIXED = False -> Bug discovered
        demo_pkg.FIXED = False
        findings = await xss_mod.run(page, client, scan_id="test_xss")
        assert len(findings) > 0
        finding = findings[0]
        assert "nspmarker" in finding.signal

        # 2. FIXED = True -> Retest passes
        demo_pkg.FIXED = True
        retest_passed = await xss_mod.retest(finding, client)
        assert retest_passed is True

@pytest.mark.asyncio
async def test_session_module_fixed_flow(demo_server):
    base_url = demo_server
    page = {
        "url": f"{base_url}/login",
        "query_params": [],
        "forms": [],
        "set_cookies": []
    }
    session_mod = SessionModule()

    async with httpx.AsyncClient() as client:
        # 1. FIXED = False -> Bug discovered
        demo_pkg.FIXED = False
        findings = await session_mod.run(page, client, scan_id="test_session")
        assert len(findings) > 0
        finding = findings[0]
        assert "session_id" in finding.param
        assert "HttpOnly" in finding.signal

        # 2. FIXED = True -> Retest passes
        demo_pkg.FIXED = True
        retest_passed = await session_mod.retest(finding, client)
        assert retest_passed is True

