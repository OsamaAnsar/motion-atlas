"""
Motion Atlas API — skeleton (Milestone 4+ fills this in).

For now it boots, applies CORS, and answers `GET /api/health` so the frontend's
`ApiProvider` has something to talk to when `NEXT_PUBLIC_DEMO_MODE=false`.
"""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings

settings = get_settings()

app = FastAPI(
    title="Motion Atlas API",
    version="0.1.0",
    summary="Controlled bridge between Motion Atlas and ComfyUI / Wan 2.2.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health() -> dict[str, object]:
    """Subsystem status. `demo` means "not wired yet / simulated"."""
    return {
        "api": "online",
        "comfyui": "demo",
        "gpu": "demo",
        "model": settings.model_name,
        "demoMode": settings.demo_mode,
        "workflowsLoaded": False,
    }


@app.get("/")
def root() -> dict[str, str]:
    return {"service": "motion-atlas-api", "docs": "/docs", "health": "/api/health"}
