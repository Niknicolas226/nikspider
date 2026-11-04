"""OAST — Out-of-Band Application Security Testing listener.

Standalone FastAPI-based OAST server that intercepts callbacks from SSRF,
SSTI, XXE, and CMDi probes. Shares the in-memory callback registry with the
NikSpider stages via nikspider.stage2_spiderpois.oracles.

Run standalone:
    uvicorn oast_listener.server:app --port 9337

Or as a subprocess:
    python -m oast_listener.server
"""

import asyncio
from datetime import datetime, timezone

from fastapi import FastAPI, Request
from fastapi.responses import PlainTextResponse

from nikspider.stage2_spiderpois.oracles.oast import OastListener

app = FastAPI(title="NikSpider OAST Listener")
_listener = OastListener(port=9337)


@app.on_event("startup")
async def startup():
    await _listener.start()
    print(f"[oast] listener bound to :{_listener.port}")


@app.on_event("shutdown")
async def shutdown():
    await _listener.stop()


@app.get("/{path:path}")
@app.post("/{path:path}")
async def catch_all(request: Request, path: str):
    """Log any callback that matches a registered canary token."""
    body = await request.body()
    client_ip = request.client.host if request.client else "unknown"
    from nikspider.stage2_spiderpois.oracles.inband import oast_mark_hit, OAST_CALLBACKS
    full_url = str(request.url)
    hit = False
    for token in list(OAST_CALLBACKS.keys()):
        if token in full_url or token in body.decode(errors="replace"):
            oast_mark_hit(token, client_ip)
            hit = True
    return PlainTextResponse("ok" if hit else "noop")


if __name__ == "__main__":
    import uvicorn
    print("NikSpider OAST listener on :9337")
    uvicorn.run(app, host="0.0.0.0", port=9337, log_level="info")