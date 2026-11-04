"""Structured logging for NikSpider pipeline stages."""

import logging
import json
import sys
from datetime import datetime, timezone


def get_logger(name: str) -> logging.Logger:
    logger = logging.getLogger(name)
    if not logger.handlers:
        handler = logging.StreamHandler(sys.stderr)
        handler.setFormatter(logging.Formatter(
            '%(asctime)s [%(name)s] %(levelname)s %(message)s',
            datefmt='%Y-%m-%dT%H:%M:%S'
        ))
        logger.addHandler(handler)
        logger.setLevel(logging.INFO)
    return logger


def log_scan_event(logger: logging.Logger, scan_id: str, stage: str, msg: str,
                   level: str = "info", data: dict | None = None) -> None:
    log_fn = getattr(logger, level, logger.info)
    extra = {"scan_id": scan_id, "stage": stage}
    if data:
        extra["data"] = json.dumps(data, default=str)
    log_fn(msg, extra=extra)
