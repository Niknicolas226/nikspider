"""API layer — mounts the staged routes. Compatible with uvicorn:

    uvicorn api.main:app
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os

from api.routes.main import router as v2_router
from api.routes.evidence import evidence_router
from api.websocket import ws_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    from nikspider.common.db import init_db
    init_db()
    yield


app = FastAPI(
    title="NikSpider Security Intelligence API (v2 staged)",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "*").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(v2_router)
app.include_router(evidence_router)
app.include_router(ws_router)


@app.get("/")
async def root():
    return {"service": "nikspider", "version": "2.0.0", "api": "/api/v2"}