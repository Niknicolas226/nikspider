"""Backend fallback module — used when nikspider.* imports fail.
Provides minimal aliases for the orchestrator imports.
"""

# Re-export from nikspider.common
from nikspider.common.db import get_db, init_db, log_request  # noqa: F401
from nikspider.common.models import Finding  # noqa: F401
from nikspider.stage0_intake_guard.guard import GuardedClient, is_allowed_target  # noqa: F401

__all__ = ["get_db", "init_db", "log_request", "Finding", "GuardedClient", "is_allowed_target"]