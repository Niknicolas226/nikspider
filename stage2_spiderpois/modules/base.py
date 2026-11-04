"""Backward-compatible module base re-export.

Historically callers imported ``Finding`` from ``modules.base``. The canonical
model now lives in ``nikspider.common.models``; this module keeps the old
import path working.
"""

from nikspider.common.models import Finding
from nikspider.stage2_spiderpois.base import CheckModule  # noqa: F401

__all__ = ["Finding", "CheckModule"]