"""Oracle families — in-band, OAST, browser (Tier 2), timing (Tier 2)."""

import asyncio
import re
import secrets
import time
from dataclasses import dataclass, field
from typing import Any


# --- In-band oracle: regex/diff on response ---

def inband_error(response_text: str, patterns: list[re.Pattern]) -> str | None:
    """Search for error signatures in response text."""
    for pattern in patterns:
        match = pattern.search(response_text)
        if match:
            return match.group(0)
    return None


def inband_reflection(response_text: str, marker: str) -> bool:
    """Check if an unescaped marker appears in the response."""
    return marker in response_text


def inband_diff(
    baseline: str,
    probe: str,
    payload: str,
    min_diff_ratio: float = 0.05,
) -> bool:
    """Check if probe response differs meaningfully from baseline.

    Normalizes out the payload itself and whitespace before comparing.
    """
    def clean(text: str, payload: str) -> str:
        t = text.replace(payload, "").replace(secrets.token_hex(4), "")
        return " ".join(t.split())

    b = clean(baseline, payload)
    p = clean(probe, payload)
    if len(b) == 0 or len(p) == 0:
        return False
    max_len = max(len(b), len(p))
    # Simple difference ratio
    diff = sum(1 for a, c in zip(b, p) if a != c) + abs(len(b) - len(p))
    return diff / max_len > min_diff_ratio


# --- OAST oracle (Tier 1 — callback listener) ---

OAST_CALLBACKS: dict[str, dict[str, Any]] = {}


def oast_register(token: str) -> None:
    """Register an OAST callback token."""
    OAST_CALLBACKS[token] = {"hit": False, "ts": time.time(), "source_ip": None}


def oast_mark_hit(token: str, source_ip: str | None = None) -> None:
    """Mark an OAST callback as received."""
    if token in OAST_CALLBACKS:
        OAST_CALLBACKS[token]["hit"] = True
        OAST_CALLBACKS[token]["source_ip"] = source_ip


def oast_check(token: str, timeout_sec: float = 30.0) -> bool:
    """Check if an OAST callback was received within the timeout."""
    info = OAST_CALLBACKS.get(token)
    if not info:
        return False
    return info["hit"] and (time.time() - info["ts"] < timeout_sec)


def oast_generate_canary() -> str:
    """Generate a unique OAST canary token."""
    token = secrets.token_hex(16)
    oast_register(token)
    return token


# --- Timing oracle (Tier 2) ---

async def timing_probe(
    client,
    url: str,
    method: str = "GET",
    data: dict | None = None,
    samples: int = 5,
    delay: float = 0.1,
) -> float:
    """Measure median response time over N samples."""
    times = []
    for _ in range(samples):
        start = time.monotonic()
        try:
            if method == "GET":
                await client.get(url, timeout=10.0)
            else:
                await client.post(url, data=data, timeout=10.0)
        except Exception:
            pass
        elapsed = time.monotonic() - start
        times.append(elapsed)
        await asyncio.sleep(delay)
    if not times:
        return 0.0
    times.sort()
    return times[len(times) // 2]


def timing_is_slow(median: float, baseline: float, factor: float = 5.0) -> bool:
    """Check if median time exceeds baseline by a significant factor."""
    if baseline == 0:
        return median > 1.0
    return median > baseline * factor


# --- Browser oracle (Tier 2) ---

async def browser_exec(
    url: str,
    payload_js: str,
    timeout_ms: int = 5000,
) -> bool:
    """Use Playwright to check if JS payload executes in a real browser."""
    try:
        from playwright.async_api import async_playwright
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            page = await browser.new_page()
            # Set up a CSP violation listener
            violations: list[dict] = []
            page.on("console", lambda msg: violations.append({"type": "console", "text": msg.text}))

            await page.goto(url, wait_until="networkidle", timeout=timeout_ms)
            await page.evaluate(payload_js)
            await page.wait_for_timeout(500)
            await browser.close()
            return len(violations) > 0
    except Exception:
        return False