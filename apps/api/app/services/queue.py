"""Single-worker FIFO job queue — the thing that guarantees exactly one
generation touches the GPU at a time (`MAX_GPU_WORKERS=1`).

Flow:  submit → asyncio.Queue → worker → VRAM gate → provider.run → finalize
Extra requests wait FIFO with a live `queue_position`.
"""

from __future__ import annotations

import asyncio
import contextlib
import uuid
from collections.abc import Callable

from .. import repository as repo
from ..config import Settings
from ..errors import (
    CudaOutOfMemoryError,
    MotionAtlasError,
    NotFoundError,
    QueueFullError,
    ValidationError,
)
from ..logging import get_logger
from ..models import Generation
from ..providers.base import RunContext, VideoInferenceProvider
from ..schemas import (
    STAGE_ORDER,
    TERMINAL,
    CreateGenerationResponse,
    GenerationCreate,
    GenerationStatus,
    empty_timeline,
)
from ..services import storage
from ..services.events import EventBus
from ..services.gpu import GpuService

log = get_logger("queue")

_ACTIVE_STAGES = {s.value for s in STAGE_ORDER if s != GenerationStatus.completed}


class JobManager:
    def __init__(
        self,
        provider: VideoInferenceProvider,
        bus: EventBus,
        gpu: GpuService,
        settings: Settings,
    ) -> None:
        self._provider = provider
        self._bus = bus
        self._gpu = gpu
        self._settings = settings
        self._queue: asyncio.Queue[str] = asyncio.Queue()
        self._worker: asyncio.Task[None] | None = None
        self._running_id: str | None = None
        self._cancelled: set[str] = set()
        self._live: dict[str, dict] = {}

    # ── lifecycle ─────────────────────────────────────────────────────────────

    async def start(self) -> None:
        rows = await asyncio.to_thread(repo.active_queue)
        for row in rows:
            if row.status == GenerationStatus.queued.value:
                self._queue.put_nowait(row.job_id)
            else:
                await asyncio.to_thread(
                    repo.update, row.job_id, _mark_failed("Interrupted by a server restart.")
                )
                self._publish_terminal(row.job_id)
        self._worker = asyncio.create_task(self._run_worker(), name="gpu-worker")
        log.info("queue started", extra={"provider": self._provider.kind, "requeued": len(rows)})

    async def stop(self) -> None:
        if self._worker:
            self._worker.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await self._worker

    # ── public API ────────────────────────────────────────────────────────────

    async def submit(self, payload: GenerationCreate) -> CreateGenerationResponse:
        self._validate(payload)
        active = await asyncio.to_thread(repo.count_active)
        if active >= self._settings.max_queue_size:
            raise QueueFullError(
                f"Queue is full ({self._settings.max_queue_size} max). Try again shortly."
            )

        job_id = f"gen_{uuid.uuid4().hex[:12]}"
        s = payload.settings
        row = Generation(
            job_id=job_id,
            mode=payload.mode.value,
            prompt=payload.prompt if self._settings.store_prompts else "",
            negative_prompt=payload.negative_prompt if self._settings.store_prompts else "",
            image_name=payload.image_name,
            seed=s.seed,
            width=s.width,
            height=s.height,
            frames=s.frames,
            fps=s.fps,
            steps=s.steps,
            guidance=s.guidance,
            status=GenerationStatus.queued.value,
            total_steps=s.steps,
            created_at=repo.now_ms(),
            demo=self._provider.kind == "demo",
        )
        tl = empty_timeline()
        tl[0].at = row.created_at
        row.timeline = tl
        await asyncio.to_thread(repo.create, row)

        self._queue.put_nowait(job_id)
        positions = await self._recompute_positions()
        pos = positions.get(job_id, active + 1)
        self._bus.publish(job_id, {"type": "queued", "jobId": job_id, "queuePosition": pos})
        log.info("job queued", extra={"job_id": job_id, "position": pos, "mode": row.mode})
        return CreateGenerationResponse(
            job_id=job_id, status=GenerationStatus.queued, queue_position=pos
        )

    async def cancel(self, job_id: str) -> None:
        row = await asyncio.to_thread(repo.get, job_id)
        if row is None:
            raise NotFoundError(f"Generation {job_id} not found.")
        if GenerationStatus(row.status) in TERMINAL:
            return
        self._cancelled.add(job_id)
        was_running = self._running_id == job_id
        if not was_running:
            await asyncio.to_thread(repo.update, job_id, _mark_cancelled())
            self._bus.publish(job_id, {"type": "status", "jobId": job_id, "status": "cancelled"})
            await self._recompute_positions()
        log.info("cancel requested", extra={"job_id": job_id, "running": was_running})

    async def delete(self, job_id: str) -> None:
        row = await asyncio.to_thread(repo.get, job_id)
        if row is None:
            raise NotFoundError(f"Generation {job_id} not found.")
        if GenerationStatus(row.status) not in TERMINAL:
            self._cancelled.add(job_id)
            await asyncio.to_thread(repo.update, job_id, _mark_cancelled())
        await asyncio.to_thread(repo.delete, job_id)
        storage.delete_generation_files(job_id)

    # ── validation ────────────────────────────────────────────────────────────

    def _validate(self, payload: GenerationCreate) -> None:
        s = payload.settings
        st = self._settings
        if s.width > st.max_width or s.height > st.max_height:
            raise ValidationError(
                f"Resolution {s.width}×{s.height} exceeds the RTX 3070 limit "
                f"({st.max_width}×{st.max_height})."
            )
        if s.width <= 0 or s.height <= 0 or s.width % 8 or s.height % 8:
            raise ValidationError("Width and height must be positive multiples of 8.")
        if not (st.min_frames <= s.frames <= st.max_frames):
            raise ValidationError(f"Frames must be between {st.min_frames} and {st.max_frames}.")
        if not (st.min_steps <= s.steps <= st.max_steps):
            raise ValidationError(f"Steps must be between {st.min_steps} and {st.max_steps}.")
        if s.fps not in st.fps_options:
            raise ValidationError(f"FPS must be one of {list(st.fps_options)}.")
        if s.seed < 0:
            raise ValidationError("Seed must be non-negative.")
        if payload.mode.value == "image-to-video" and not payload.image_name:
            raise ValidationError("image-to-video requires an uploaded image.")

    # ── worker ────────────────────────────────────────────────────────────────

    async def _run_worker(self) -> None:
        while True:
            job_id = await self._queue.get()
            try:
                await self._run_one(job_id)
            except Exception:  # noqa: BLE001 — a bad job must never kill the worker
                log.exception("worker error", extra={"job_id": job_id})
            finally:
                self._running_id = None
                self._live.pop(job_id, None)
                self._cancelled.discard(job_id)
                self._queue.task_done()
                await self._recompute_positions()

    async def _run_one(self, job_id: str) -> None:
        row = await asyncio.to_thread(repo.get, job_id)
        if row is None or GenerationStatus(row.status) in TERMINAL:
            return
        if job_id in self._cancelled:
            await asyncio.to_thread(repo.update, job_id, _mark_cancelled())
            self._bus.publish(job_id, {"type": "status", "jobId": job_id, "status": "cancelled"})
            return

        await self._await_vram_headroom(job_id)

        self._running_id = job_id
        started = repo.now_ms()
        self._live[job_id] = {"progress": 0.0, "current_step": 0, "total_steps": row.steps,
                              "status": "preparing", "marks": {}}
        await asyncio.to_thread(
            repo.update, job_id, _start_mutator(started)
        )
        self._bus.publish(job_id, {"type": "started", "jobId": job_id, "promptId": None})

        persister = asyncio.create_task(self._persist_live(job_id))
        ctx = RunContext(
            row=row,
            emit=self._make_emit(job_id),
            is_cancelled=lambda: job_id in self._cancelled,
            gpu=self._gpu,
            settings=self._settings,
        )
        try:
            outcome = await self._provider.run(ctx)
        except CudaOutOfMemoryError as exc:
            await self._finalize_failure(job_id, exc.detail, started)
            log.warning("cuda oom", extra={"job_id": job_id})
            return
        except MotionAtlasError as exc:
            await self._finalize_failure(job_id, exc.detail, started)
            return
        except Exception as exc:  # noqa: BLE001
            await self._finalize_failure(job_id, f"Unexpected error: {exc}", started)
            log.exception("provider crashed", extra={"job_id": job_id})
            return
        finally:
            persister.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await persister

        if job_id in self._cancelled:
            await asyncio.to_thread(repo.update, job_id, _mark_cancelled())
            self._bus.publish(job_id, {"type": "status", "jobId": job_id, "status": "cancelled"})
            return

        await self._finalize_success(job_id, outcome, started)

    async def _await_vram_headroom(self, job_id: str) -> None:
        threshold = self._settings.gpu_start_vram_threshold_mb
        for attempt in range(30):  # ~60s cap, then proceed anyway
            free = await self._gpu.free_vram_mb()
            if free is None or free >= threshold:
                return
            if attempt == 0:
                self._bus.publish(
                    job_id,
                    {"type": "status", "jobId": job_id, "status": "queued"},
                )
                log.info("holding for vram", extra={"job_id": job_id, "free_mb": free})
            await asyncio.sleep(2.0)
        log.warning("vram gate timed out; proceeding", extra={"job_id": job_id})

    # ── event → state plumbing ───────────────────────────────────────────────

    def _make_emit(self, job_id: str):
        def emit(event: dict) -> None:
            self._bus.publish(job_id, event)
            live = self._live.get(job_id)
            if live is None:
                return
            if event.get("type") == "status":
                st = event["status"]
                live["status"] = st
                live["marks"].setdefault(st, repo.now_ms())
            elif event.get("type") == "progress":
                live["progress"] = event.get("progress", live["progress"])
                live["current_step"] = event.get("step", live["current_step"])
                live["total_steps"] = event.get("totalSteps", live["total_steps"])

        return emit

    async def _persist_live(self, job_id: str) -> None:
        try:
            while True:
                await asyncio.sleep(1.0)
                live = self._live.get(job_id)
                if not live:
                    continue
                snapshot = dict(live)

                def mutate(r: Generation, snap: dict = snapshot) -> None:
                    r.status = snap["status"]
                    r.progress = snap["progress"]
                    r.current_step = snap["current_step"]
                    r.total_steps = snap["total_steps"] or r.steps
                    tl = r.timeline
                    for entry in tl:
                        mark = snap["marks"].get(entry.status.value)
                        if mark and entry.at is None:
                            entry.at = mark
                    r.timeline = tl

                await asyncio.to_thread(repo.update, job_id, mutate)
        except asyncio.CancelledError:
            raise

    async def _finalize_success(self, job_id: str, outcome, started: int) -> None:
        done = repo.now_ms()
        gen_seconds = (done - started) / 1000
        marks = dict(self._live.get(job_id, {}).get("marks", {}))

        def mutate(r: Generation) -> None:
            r.status = GenerationStatus.completed.value
            r.progress = 1.0
            r.completed_at = done
            r.generation_seconds = gen_seconds
            r.current_step = r.steps
            r.total_steps = r.steps
            r.prompt_id = outcome.prompt_id
            r.peak_vram_mb = outcome.peak_vram_mb
            r.average_gpu_utilization = outcome.average_gpu_utilization
            if outcome.gpu_samples:
                r.gpu_samples = outcome.gpu_samples
            if outcome.output_file:
                r.output_file = outcome.output_file
            tl = outcome.timeline or r.timeline
            for entry in tl:
                mk = marks.get(entry.status.value)
                if mk and entry.at is None:
                    entry.at = mk
            for entry in tl:
                if entry.status == GenerationStatus.completed and entry.at is None:
                    entry.at = done
            r.timeline = tl

        row = await asyncio.to_thread(repo.update, job_id, mutate)
        if row is None:
            return
        dto = row.to_dto(
            output_url=self._output_url(row), expose_prompt=self._settings.store_prompts
        )
        self._bus.publish(job_id, {"type": "status", "jobId": job_id, "status": "completed"})
        self._bus.publish(
            job_id,
            {"type": "completed", "jobId": job_id, "job": dto.model_dump(by_alias=True)},
        )
        log.info(
            "job completed",
            extra={
                "job_id": job_id,
                "generation_seconds": round(gen_seconds, 2),
                "peak_vram": outcome.peak_vram_mb,
                "avg_gpu": outcome.average_gpu_utilization,
            },
        )

    async def _finalize_failure(self, job_id: str, detail: str, started: int) -> None:
        done = repo.now_ms()

        def mutate(r: Generation) -> None:
            r.status = GenerationStatus.failed.value
            r.error = detail
            r.completed_at = done
            r.generation_seconds = (done - started) / 1000

        await asyncio.to_thread(repo.update, job_id, mutate)
        storage.delete_generation_files(job_id)
        self._bus.publish(job_id, {"type": "status", "jobId": job_id, "status": "failed"})
        self._bus.publish(job_id, {"type": "failed", "jobId": job_id, "error": detail})

    # ── helpers ───────────────────────────────────────────────────────────────

    async def _recompute_positions(self) -> dict[str, int]:
        rows = await asyncio.to_thread(repo.active_queue)
        positions: dict[str, int] = {}
        pos = 0
        for row in rows:
            if row.job_id == self._running_id or row.status != GenerationStatus.queued.value:
                if row.queue_position is not None:
                    await asyncio.to_thread(repo.update, row.job_id, _set_position(None))
                continue
            pos += 1
            positions[row.job_id] = pos
            if row.queue_position != pos:
                await asyncio.to_thread(repo.update, row.job_id, _set_position(pos))
                self._bus.publish(
                    row.job_id, {"type": "queued", "jobId": row.job_id, "queuePosition": pos}
                )
        return positions

    def _output_url(self, row: Generation) -> str | None:
        if row.output_file and storage.generation_video_path(row.job_id).is_file():
            return f"/api/generations/{row.job_id}/video"
        return None

    def _publish_terminal(self, job_id: str) -> None:
        self._bus.publish(job_id, {"type": "failed", "jobId": job_id,
                                   "error": "Interrupted by a server restart."})


# ── module-level mutation helpers ────────────────────────────────────────────


Mutator = Callable[[Generation], None]


def _set_position(value: int | None) -> Mutator:
    def _m(r: Generation) -> None:
        r.queue_position = value

    return _m


def _start_mutator(started_at: int) -> Mutator:
    def _m(r: Generation) -> None:
        r.started_at = started_at
        r.status = "preparing"

    return _m


def _mark_failed(detail: str) -> Mutator:
    def _m(r: Generation) -> None:
        r.status = GenerationStatus.failed.value
        r.error = detail
        r.completed_at = repo.now_ms()

    return _m


def _mark_cancelled() -> Mutator:
    def _m(r: Generation) -> None:
        r.status = GenerationStatus.cancelled.value
        r.completed_at = repo.now_ms()
        if r.started_at:
            r.generation_seconds = (r.completed_at - r.started_at) / 1000

    return _m
