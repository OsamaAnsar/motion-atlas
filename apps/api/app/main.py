"""Motion Atlas API — the controlled bridge between the web app and ComfyUI.

Milestones 4–14: FastAPI, asyncio job queue, SQLite persistence, GPU telemetry,
ComfyUI health + workflow submission + WebSocket tracking + video retrieval,
image-to-video uploads, error handling, optional rate limiting.

`DEMO_MODE=true` (default) runs a server-side simulation so the whole stack works
without a GPU. Set it false + provide a ComfyUI workflow for real generation.
"""

from __future__ import annotations

import asyncio
import time
from collections import defaultdict
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .config import get_settings
from .db import init_db
from .errors import install_error_handlers
from .logging import configure_logging, get_logger
from .providers import ComfyUIProvider, DemoInferenceProvider
from .routers import generations, gpu, health, uploads
from .services import storage
from .services.events import EventBus
from .services.gpu import GpuService
from .services.queue import JobManager

settings = get_settings()
configure_logging("DEBUG" if settings.app_env == "development" else "INFO")
log = get_logger("main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()

    provider = DemoInferenceProvider() if settings.demo_mode else ComfyUIProvider()
    bus = EventBus()
    gpu_service = GpuService()
    manager = JobManager(provider, bus, gpu_service, settings)

    app.state.provider = provider
    app.state.event_bus = bus
    app.state.gpu_service = gpu_service
    app.state.job_manager = manager

    await manager.start()
    sweeper = asyncio.create_task(_upload_sweeper())
    log.info(
        "api ready",
        extra={"demo_mode": settings.demo_mode, "provider": provider.kind, "env": settings.app_env},
    )
    try:
        yield
    finally:
        sweeper.cancel()
        await manager.stop()


app = FastAPI(
    title="Motion Atlas API",
    version="0.2.0",
    summary="Controlled bridge between Motion Atlas and ComfyUI / Wan 2.2.",
    lifespan=lifespan,
)

if settings.app_env == "development":
    # Any localhost port during dev (web on :3000, ad-hoc ports, etc.)
    app.add_middleware(
        CORSMiddleware,
        allow_origin_regex=r"http://(localhost|127\.0\.0\.1)(:\d+)?",
        allow_methods=["*"],
        allow_headers=["*"],
    )
else:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_methods=["*"],
        allow_headers=["*"],
    )

install_error_handlers(app)

# ── optional per-IP daily rate limit (Milestone 14) ─────────────────────────
_rl_hits: dict[str, tuple[int, int]] = defaultdict(lambda: (0, 0))  # ip -> (day, count)


@app.middleware("http")
async def rate_limit(request: Request, call_next):
    if (
        settings.enable_rate_limit
        and request.method == "POST"
        and request.url.path == "/api/generations"
    ):
        ip = request.client.host if request.client else "unknown"
        day = int(time.time() // 86400)
        seen_day, count = _rl_hits[ip]
        count = count + 1 if seen_day == day else 1
        _rl_hits[ip] = (day, count)
        if count > settings.public_rate_limit:
            return JSONResponse(
                status_code=429,
                content={
                    "error": "rate_limited",
                    "detail": f"Limit is {settings.public_rate_limit} generations per day.",
                },
            )
    return await call_next(request)


app.include_router(health.router, prefix="/api")
app.include_router(gpu.router, prefix="/api")
app.include_router(uploads.router, prefix="/api")
app.include_router(generations.router, prefix="/api")


@app.get("/")
def root() -> dict[str, str]:
    return {"service": "motion-atlas-api", "docs": "/docs", "health": "/api/health"}


async def _upload_sweeper() -> None:
    while True:
        try:
            await asyncio.to_thread(storage.sweep_uploads)
        except Exception:  # noqa: BLE001
            log.exception("upload sweep failed")
        await asyncio.sleep(3600)
