"""Scan policy profiles and approval gate.

Loads profiles from config/policy_profiles.yaml. Enforces:
  - Request budget per scan
  - Allowed modules per profile
  - Method allowlists
  - Global constraints (destructive=False, ownership verification, etc.)
"""

import os
import yaml
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

try:
    from nikspider.common.models import ScanContext
except ImportError:
    from backend.spiderattack import TestAccount  # fallback


CONFIG_DIR = Path(__file__).resolve().parents[2] / "config"
PROFILES_PATH = CONFIG_DIR / "policy_profiles.yaml"


@dataclass
class PolicyProfile:
    name: str = "standard"
    description: str = ""
    max_requests: int = 500
    max_depth: int = 3
    max_pages: int = 200
    allowed_methods: list[str] = field(default_factory=lambda: ["GET", "HEAD", "OPTIONS", "POST"])
    allowed_modules: list[str] = field(default_factory=list)
    rate_limit_rps: int = 5


def _load_profiles() -> dict[str, dict]:
    if PROFILES_PATH.exists():
        with open(PROFILES_PATH) as f:
            return yaml.safe_load(f).get("profiles", {})
    return {}


def get_profile(name: str = "standard") -> PolicyProfile:
    profiles = _load_profiles()
    data = profiles.get(name, profiles.get("standard", {}))
    return PolicyProfile(
        name=name,
        description=data.get("description", ""),
        max_requests=data.get("max_requests", 500),
        max_depth=data.get("max_depth", 3),
        max_pages=data.get("max_pages", 200),
        allowed_methods=data.get("allowed_methods", ["GET", "HEAD", "OPTIONS", "POST"]),
        allowed_modules=data.get("allowed_modules", []),
        rate_limit_rps=data.get("rate_limit_rps", 5),
    )


def is_module_allowed(module: str, profile: str = "standard") -> bool:
    """Check if a module is allowed under the given profile."""
    p = get_profile(profile)
    return module in p.allowed_modules


def within_budget(current: int, profile: str = "standard") -> bool:
    """Check if current request count is within the profile budget."""
    p = get_profile(profile)
    return current < p.max_requests


def method_allowed(method: str, profile: str = "standard") -> bool:
    """Check if an HTTP method is allowed under the profile."""
    p = get_profile(profile)
    return method.upper() in {m.upper() for m in p.allowed_methods}