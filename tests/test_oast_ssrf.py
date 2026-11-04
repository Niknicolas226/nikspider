"""OAST / SSRF oracle tests — proves the out-of-band path detects real SSRF.

Starts the OAST listener, points the SSRF module at it, and verifies:
  - a vulnerable endpoint produces exactly one OAST-backed finding
  - a redirect-only endpoint (which merely forwards the client) does NOT
  - retest flips from still_open to fixed once the app is patched
"""

import asyncio
import os
import socket
import threading
import time

import pytest
import uvicorn
from werkzeug.serving import make_server

os.environ["DEMO_MODE"] = "1"

import demo_app.app as demo_pkg
from oast_listener.server import app as oast_app


def _free_port() -> int:
    s = socket.socket()
    s.bind(("127.0.0.1", 0))
    port = s.getsockname()[1]
    s.close()
    return port


@pytest.fixture(scope="module")
def oast_server():
    port = _free_port()
    server = uvicorn.Server(
        uvicorn.Config(oast_app, host="127.0.0.1", port=port, log_level="error")
    )
    t = threading.Thread(target=server.run, daemon=True)
    t.start()

    # Wait for bind
    deadline = time.time() + 15
    while time.time() < deadline:
        try:
            with socket.create_connection(("127.0.0.1", port), timeout=0.5):
                break
        except OSError:
            time.sleep(0.1)

    old = os.environ.get("OAST_CALLBACK_HOST")
    os.environ["OAST_CALLBACK_HOST"] = f"127.0.0.1:{port}"
    yield port
    server.should_exit = True
    if old is None:
        os.environ.pop("OAST_CALLBACK_HOST", None)
    else:
        os.environ["OAST_CALLBACK_HOST"] = old


@pytest.fixture(scope="module")
def demo_target():
    demo_pkg.FIXED = False
    server = make_server("127.0.0.1", 5093, demo_pkg.app)
    t = threading.Thread(target=server.serve_forever, daemon=True)
    t.start()
    time.sleep(0.6)
    yield "http://127.0.0.1:5093"
    demo_pkg.FIXED = False
    server.shutdown()


@pytest.mark.asyncio
async def test_oast_listener_receives_callback(oast_server):
    """The listener must register a hit when a canary URL is requested."""
    import urllib.request
    from nikspider.stage2_spiderpois.oracles.inband import (
        oast_generate_canary,
        oast_check,
    )

    token = oast_generate_canary()
    assert oast_check(token) is False
    urllib.request.urlopen(f"http://127.0.0.1:{oast_server}/cb/{token}", timeout=5).read()
    assert oast_check(token) is True


@pytest.mark.asyncio
async def test_ssrf_detected_via_oast(oast_server, demo_target):
    """A real server-side fetch of the canary must yield exactly one SSRF finding."""
    from nikspider.spiderattack import SpiderAttack

    attack = SpiderAttack(
        demo_target,
        profile="standard",
        max_pages=10,
        modules=["ssrf"],
        seed_endpoints=[f"{demo_target}/fetch?url=http://example.com/"],
    )
    result = await attack.run()

    assert "error" not in result
    ssrf = [f for f in result["findings"] if f["module"] == "ssrf"]
    assert len(ssrf) == 1, f"expected exactly 1 SSRF finding, got {ssrf}"
    assert "/fetch" in ssrf[0]["url"]

    # Redirect-only endpoint must not be reported (client-side forward, not SSRF)
    assert not any("/redirect" in f["url"] for f in ssrf), (
        "open-redirect endpoint leaked into SSRF findings"
    )


@pytest.mark.asyncio
async def test_ssrf_retest_flips_to_fixed(oast_server, demo_target):
    """Retest must report still_open while vulnerable and fixed after patching."""
    from nikspider.spiderattack import SpiderAttack
    from nikspider.stage6_close_the_loop.retest import retest_finding
    from nikspider.stage0_intake_guard.guard import GuardedClient

    attack = SpiderAttack(
        demo_target,
        profile="standard",
        max_pages=10,
        modules=["ssrf"],
        seed_endpoints=[f"{demo_target}/fetch?url=http://example.com/"],
    )
    result = await attack.run()
    ssrf = [f for f in result["findings"] if f["module"] == "ssrf"]
    assert ssrf, "SSRF finding required for retest check"
    finding = ssrf[0]

    async with GuardedClient(timeout=20.0, verify=False) as client:
        still = await retest_finding(finding, client)
        assert still["status"] == "still_open", still

        demo_pkg.FIXED = True
        try:
            fixed = await retest_finding(finding, client)
        finally:
            demo_pkg.FIXED = False

    assert fixed["status"] == "fixed", fixed