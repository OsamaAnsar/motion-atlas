from __future__ import annotations

import asyncio
import contextlib

from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse

from .. import repository as repo
from ..config import get_settings
from ..errors import NotFoundError
from ..logging import get_logger
from ..models import Generation
from ..schemas import (
    TERMINAL,
    CreateGenerationResponse,
    GenerationCreate,
    GenerationJob,
    GenerationStatus,
)
from ..services import storage
from ..services.events import EventBus
from ..services.queue import JobManager
from . import deps

log = get_logger("routes.generations")
router = APIRouter(prefix="/generations", tags=["generations"])
settings = get_settings()


def _output_url(row: Generation) -> str | None:
    if row.output_file and storage.generation_video_path(row.job_id).is_file():
        return f"/api/generations/{row.job_id}/video"
    return None


def _to_dto(row: Generation) -> GenerationJob:
    return row.to_dto(output_url=_output_url(row), expose_prompt=settings.store_prompts)


@router.post("", response_model=CreateGenerationResponse, status_code=201)
async def create_generation(
    payload: GenerationCreate,
    manager: JobManager = Depends(deps.job_manager),
) -> CreateGenerationResponse:
    return await manager.submit(payload)


@router.get("", response_model=list[GenerationJob])
async def list_generations() -> list[GenerationJob]:
    rows = await asyncio.to_thread(repo.list_recent, 60)
    return [_to_dto(r) for r in rows]


@router.get("/{job_id}", response_model=GenerationJob)
async def get_generation(job_id: str) -> GenerationJob:
    row = await asyncio.to_thread(repo.get, job_id)
    if row is None:
        raise NotFoundError(f"Generation {job_id} not found.")
    return _to_dto(row)


@router.post("/{job_id}/cancel", status_code=202)
async def cancel_generation(
    job_id: str, manager: JobManager = Depends(deps.job_manager)
) -> dict[str, str]:
    await manager.cancel(job_id)
    return {"status": "cancelling"}


@router.delete("/{job_id}", status_code=204)
async def delete_generation(
    job_id: str, manager: JobManager = Depends(deps.job_manager)
) -> None:
    await manager.delete(job_id)


@router.get("/{job_id}/video")
async def get_video(job_id: str) -> FileResponse:
    row = await asyncio.to_thread(repo.get, job_id)
    if row is None:
        raise NotFoundError(f"Generation {job_id} not found.")
    path = storage.generation_video_path(job_id)
    if not path.is_file():
        raise NotFoundError("No rendered video for this generation.")
    return FileResponse(
        path,
        media_type="video/mp4",
        filename=f"motion-atlas-{row.seed}.mp4",
    )


@router.websocket("/{job_id}/events")
async def generation_events(websocket: WebSocket, job_id: str) -> None:
    await websocket.accept()
    bus: EventBus = websocket.app.state.event_bus

    row = await asyncio.to_thread(repo.get, job_id)
    if row is None:
        await websocket.send_json({"type": "failed", "jobId": job_id, "error": "not found"})
        await websocket.close()
        return

    queue = bus.subscribe(job_id)
    try:
        # prime late subscribers with the current status
        await websocket.send_json(
            {"type": "status", "jobId": job_id, "status": row.status}
        )
        if GenerationStatus(row.status) in TERMINAL:
            await websocket.send_json(_terminal_event(row))
            return

        while True:
            event = await queue.get()
            await websocket.send_json(event)
            if _is_terminal_event(event):
                break
    except WebSocketDisconnect:
        pass
    finally:
        bus.unsubscribe(job_id, queue)
        with contextlib.suppress(RuntimeError):
            await websocket.close()


def _is_terminal_event(event: dict) -> bool:
    if event.get("type") in ("completed", "failed"):
        return True
    return event.get("type") == "status" and event.get("status") in (
        "completed",
        "failed",
        "cancelled",
    )


def _terminal_event(row: Generation) -> dict:
    if row.status == GenerationStatus.completed.value:
        dto = _to_dto(row).model_dump(by_alias=True)
        return {"type": "completed", "jobId": row.job_id, "job": dto}
    if row.status == GenerationStatus.failed.value:
        return {"type": "failed", "jobId": row.job_id, "error": row.error or "failed"}
    return {"type": "status", "jobId": row.job_id, "status": row.status}
