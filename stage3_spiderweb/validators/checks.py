"""Validation suite — plausibility, fruit, sanity checks for findings.

Each validator takes a finding + a few signals and returns pass/fail.
Used after confirm() to filter false positives before triage.
"""

import re
import json
from typing import Any
from nikspider.common.models import Finding
from nikspider.stage2_spiderpois.modules.sqli import find_sql_error


def plausibility(finding: Finding | dict) -> tuple[bool, str]:
    """Check if the finding is logically plausible based on the module type."""
    if isinstance(finding, Finding):
        module = finding.module
        url = finding.url
        signal = finding.signal
        response = finding.response
    else:
        module = finding.get("module", "")
        url = finding.get("url", "")
        signal = finding.get("signal", "") or ""
        response = finding.get("response", "") or ""

    if not module:
        return False, "No module specified"

    # SQli: error-based needs a DB error signature; boolean-differential
    # is validated by the probe itself (consistent TRUE/FALSE response
    # divergence across two independent round-trips). Field evidence is
    # sufficient — boolean differential deliberately avoids triggering
    # DB errors.
    if module == "sqli":
        sql_patterns = ["sql", "syntax error", "operationalerror", "mysql", "pg_query", "sqlite",
                        "unrecognized token", "error in your sql"]
        signal_lower = signal.lower()
        has_sql = any(p in (signal_lower + response.lower()) for p in sql_patterns)
        is_boolean = "boolean" in signal_lower
        if has_sql:
            pass
        elif is_boolean:
            pass  # boolean differential is valid without DB error
        else:
            return False, "No SQL error signature or boolean differential evidence"

    # SSRF: must reference OAST callback
    if module == "ssrf":
        if "oast" not in signal.lower() and "callback" not in signal.lower():
            return False, "No OAST callback evidence"

    # XSS: must have marker reflection
    if module == "xss":
        has_marker = "nspmarker" in signal.lower() or "nspmarker" in response.lower()
        if not has_marker:
            return False, "No marker tag reflection evidence"

    # Exposed files: URL path must match expected sensitive file patterns
    if module == "exposed_files":
        sensitive = [".env", ".git", ".DS_Store", ".svn", "backup", "wp-config", "phpinfo",
                     "debug", "actuator", "swagger", "api-docs", "graphql", "robots.txt"]
        has_sensitive_path = any(p in url for p in sensitive)
        if not has_sensitive_path:
            return False, "Path does not match known sensitive file patterns"

    return True, "ok"


def fruit(finding: Finding | dict, context: dict | None = None) -> tuple[bool, str]:
    """Check if the finding has exploitability value (risk > 0)."""
    if isinstance(finding, Finding):
        module = finding.module
        url = finding.url
        signal = finding.signal
    else:
        module = finding.get("module", "")
        url = finding.get("url", "")
        signal = finding.get("signal", "") or ""

    # Informational-only: cache, security_headers are always low value
    informational = {"cache", "security_headers"}
    if module in informational:
        return True, "Low fruit, informational only"  # Still keep, just tagged

    # Check for HTTP scheme vs HTTPS
    if "http://" in url and module in ("session", "csrf"):
        # Less exploitable on plain HTTP
        return True, "Low fruit: plain HTTP reduces exploitability"

    return True, "ok"


def sanity(finding: Finding | dict) -> tuple[bool, str]:
    """Basic sanity check — malformed data, impossible values, etc."""
    if isinstance(finding, Finding):
        module = finding.module
        url = finding.url
        param = finding.param
    else:
        module = finding.get("module", "")
        url = finding.get("url", "")
        param = finding.get("param", "")

    if not url:
        return False, "Empty URL"
    if not module:
        return False, "Empty module"

    # URL should look like a URL
    if not (url.startswith("http://") or url.startswith("https://")):
        return False, f"URL does not start with http(s)://: {url[:80]}"

    # Module must be a known module
    KNOWN_MODULES = {
        "sqli", "xss", "headers", "cors", "session", "access", "csrf",
        "idor", "ssrf", "security_headers", "clickjacking", "exposed_files",
        "open_redirect", "cache", "oauth_jwt", "graphql", "subdomain_takeover",
        "websocket", "ssti", "xxe", "cmdi",
    }
    if module not in KNOWN_MODULES:
        return False, f"Unknown module: {module}"

    return True, "ok"


def run_all_validators(finding: Finding | dict) -> dict[str, tuple[bool, str]]:
    """Run all three validators and return results."""
    return {
        "plausibility": plausibility(finding),
        "fruit": fruit(finding),
        "sanity": sanity(finding),
    }


def passes_all(finding: Finding | dict) -> bool:
    """Check if finding passes all validators."""
    results = run_all_validators(finding)
    return all(passed for passed, _ in results.values())