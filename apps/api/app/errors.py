"""Domain errors + FastAPI handlers. Every one maps to a readable JSON body:
`{ "error": "<slug>", "detail": "<human message>" }`.
"""

from __future__ import annotations

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse


class MotionAtlasError(Exception):
    slug = "error"
    status_code = 400

    def __init__(self, detail: str) -> None:
        super().__init__(detail)
        self.detail = detail


class ValidationError(MotionAtlasError):
    slug = "invalid_config"
    status_code = 422


class QueueFullError(MotionAtlasError):
    slug = "queue_full"
    status_code = 429


class RateLimitError(MotionAtlasError):
    slug = "rate_limited"
    status_code = 429


class NotFoundError(MotionAtlasError):
    slug = "not_found"
    status_code = 404


class ComfyUIOfflineError(MotionAtlasError):
    slug = "comfyui_offline"
    status_code = 503


class WorkflowMissingError(MotionAtlasError):
    slug = "workflow_missing"
    status_code = 503


class CudaOutOfMemoryError(MotionAtlasError):
    slug = "cuda_oom"
    status_code = 507


class UploadRejectedError(MotionAtlasError):
    slug = "upload_rejected"
    status_code = 415


def install_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(MotionAtlasError)
    async def _handle(_: Request, exc: MotionAtlasError) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content={"error": exc.slug, "detail": exc.detail},
        )
