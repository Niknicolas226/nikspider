"""End-to-end tests for the staged architecture.

Spins up the bundled demo app, runs the fully staged pipeline
(stages 0-5 via Orchestrator), and asserts the golden corpus expectations
are met — proving the new `nikspider/` package works as a unit.
"""

import json
import os
import threading
import time

import asyncio
import pytest
import httpx
from werkzeug.serving import make_server

os.environ["DEMO_MODE"] = "1"
os.environ["FIXED"] = "0"

import demo_app.app as demo_pkg


class ServerThread(threading.Thread):
    def __init__(self, app, port=5096):
        super().__init__(daemon=True)
        self.server = make_server("127.0.0.1", port, app)
        self.port = port

    def run(self):
        self.server.serve_forever()

    def shutdown(self):
        self.server.shutdown()


@pytest.fixture(scope="module")
def demo_server():
    server = ServerThread(demo_pkg.app, port=5096)
    server.start()
    time.sleep(0.6)
    yield f"http://127.0.0.1:5096"
    server.shutdown()


@pytest.fixture(autouse=True)
def vulnerable_mode():
    """Force the demo app back to its vulnerable state around each test.

    Other test modules (test_modules_demo) leave demo_pkg.FIXED = True, which
    would make this module's findings disappear when the whole suite runs.
    """
    demo_pkg.FIXED = False
    yield
    demo_pkg.FIXED = False


def _load_golden(target: str) -> list[dict]:
    path = os.path.join("golden_corpus", "expected_findings", f"{target}.json")
    with open(path) as f:
        return json.load(f)


async def _wait_for(orch, scan_id, timeout: float = 240.0) -> dict:
    """Poll a scan to completion with a wall-clock deadline."""
    loop = asyncio.get_event_loop()
    deadline = loop.time() + timeout
    while loop.time() < deadline:
        res = orch.get_results(scan_id)
        if res and res.get("status") == "completed":
            return res
        if res and res.get("error"):
            pytest.fail(f"scan failed: {res['error']}")
        await asyncio.sleep(0.5)
    pytest.fail(f"scan did not complete within {timeout}s")


@pytest.mark.asyncio
async def test_staged_pipeline_matches_golden(demo_server):
    """Run the full staged pipeline and verify the golden corpus expectations."""
    from nikspider.orchestrator import Orchestrator

    orch = Orchestrator(demo_mode=True)
    scan_id = await orch.run_scan(demo_server, profile_name="standard", max_pages=20, max_depth=2)
    res = await _wait_for(orch, scan_id)

    findings = res["findings"]
    report = res["report"]

    assert len(findings) > 0, "expected at least one finding"

    # Map findings by module
    by_module: dict[str, list[dict]] = {}
    for f in findings:
        by_module.setdefault(f["module"], []).append(f)

    golden = _load_golden("demo_app")
    for expectation in golden:
        module = expectation["module"]
        assert module in by_module, (
            f"golden corpus: expected module '{module}' but got "
            f"{sorted(by_module.keys())}"
        )
        if expectation.get("signal_contains"):
            assert any(
                expectation["signal_contains"].lower() in (f.get("signal") or "").lower()
                for f in by_module[module]
            ), f"no {module} finding matches signal {expectation['signal_contains']}"

    # Report structure sanity
    assert report["risk_summary"]["total_findings"] == len(findings)
    assert report["findings"], "report should have finding entries"
    assert "sqli" in {e["module"] for e in report["findings"]}

    # Roadmap + fix prompts exist
    assert res["roadmap_nodes"], "roadmap nodes should exist"
    assert res["fix_prompts"], "fix prompts should exist"


@pytest.mark.asyncio
async def test_spiderattack_entry_outputs_raw_findings(demo_server):
    """The CLI entry (Stages 0-3) must output raw findings with no LLM/report."""
    from nikspider.spiderattack import SpiderAttack

    attack = SpiderAttack(demo_server, profile="standard", max_pages=15, max_depth=2)
    result = await attack.run()

    assert "error" not in result
    assert result["crawl_pages"] > 0
    assert len(result["findings"]) > 0

    # Raw findings — status must be raw/confirmed (dedup), not triaged/reported
    for f in result["findings"]:
        assert "module" in f
        assert "url" in f
        assert "signal" in f
        assert f["status"] in ("raw", "confirmed", "new", "duplicate", "known")


@pytest.mark.asyncio
async def test_retest_roundtrip(demo_server):
    """Confirmed findings should retest as FIXED once the demo app is patched."""
    from nikspider.orchestrator import Orchestrator

    orch = Orchestrator(demo_mode=True)
    scan_id = await orch.run_scan(demo_server, profile_name="standard", max_pages=15, max_depth=2)
    res = await _wait_for(orch, scan_id)

    findings = res["findings"]
    sqli = [f for f in findings if f["module"] == "sqli"]
    xss = [f for f in findings if f["module"] == "xss"]
    assert sqli and xss

    # Patch the app -> FIXED, then retest
    demo_pkg.FIXED = True
    time.sleep(0.3)

    from nikspider.stage6_close_the_loop.retest import retest_finding
    from nikspider.stage0_intake_guard.guard import GuardedClient

    async with GuardedClient(timeout=15.0, follow_redirects=True, verify=False) as client:
        r1 = await retest_finding(sqli[0], client)
        r2 = await retest_finding(xss[0], client)

    assert r1["status"] == "fixed", f"sqli retest should be fixed: {r1}"
    assert r2["status"] == "fixed", f"xss retest should be fixed: {r2}"
    demo_pkg.FIXED = False