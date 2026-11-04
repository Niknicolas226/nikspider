"""OAST listener server and query API — Tier 1 oracle infrastructure."""

import asyncio
import json
import secrets
from datetime import datetime, timezone
from urllib.parse import urlparse

from nikspider.stage2_spiderpois.oracles.inband import (
    oast_register,
    oast_mark_hit,
    oast_check,
    oast_generate_canary,
    OAST_CALLBACKS,
)

__all__ = ["oast_register", "oast_mark_hit", "oast_check", "oast_generate_canary",
           "OAST_CALLBACKS", "OastListener"]


class OastListener:
    """In-process OAST callback listener.

    Listens on a local port for HTTP requests and logs any that match
    registered canary tokens. Used by SSRF, SSTI, XXE, and CMDi modules.
    """

    def __init__(self, host: str = "0.0.0.0", port: int = 9337):
        self.host = host
        self.port = port
        self.server = None
        self._hits: list[dict] = []

    async def start(self) -> None:
        """Start the OAST listener in the background."""
        import uvicorn
        from fastapi import FastAPI, Request
        from fastapi.responses import PlainTextResponse

        app = FastAPI()

        @app.get("/{path:path}")
        @app.post("/{path:path}")
        async def catch_all(request: Request, path: str):
            body = await request.body()
            client_ip = request.client.host if request.client else "unknown"
            # Check all registered tokens
            full_url = str(request.url)
            for token in list(OAST_CALLBACKS.keys()):
                if token in full_url or token in body.decode(errors="replace"):
                    oast_mark_hit(token, client_ip)
                    self._hits.append({
                        "token": token,
                        "source_ip": client_ip,
                        "path": path,
                        "ts": datetime.now(timezone.utc).isoformat(),
                    })
            return PlainTextResponse("ok")

        config = uvicorn.Config(app, host=self.host, port=self.port, log_level="error")
        self.server = uvicorn.Server(config)
        asyncio.create_task(self.server.serve())

    async def stop(self) -> None:
        if self.server:
            self.server.should_exit = True

    @property
    def hits(self) -> list[dict]:
        return list(self._hits)