"""SQLModel table: `generations` — the reproducible record of every run."""

from __future__ import annotations

import json

from sqlmodel import Field, SQLModel

from .schemas import (
    GenerationJob,
    GenerationMode,
    GenerationSettings,
    GenerationStatus,
    GpuSample,
    TimelineEntry,
    empty_timeline,
)


class Generation(SQLModel, table=True):
    __tablename__ = "generations"

    job_id: str = Field(primary_key=True)
    prompt_id: str | None = None

    mode: str = GenerationMode.text_to_video.value
    prompt: str = ""
    negative_prompt: str = ""
    image_name: str | None = None

    seed: int = 0
    width: int = 0
    height: int = 0
    frames: int = 0
    fps: int = 0
    steps: int = 0
    guidance: float = 0.0

    status: str = GenerationStatus.queued.value
    progress: float = 0.0
    current_step: int = 0
    total_steps: int = 0
    queue_position: int | None = None

    created_at: int = 0
    started_at: int | None = None
    completed_at: int | None = None
    generation_seconds: float | None = None

    output_file: str | None = None
    error: str | None = None

    peak_vram_mb: int | None = None
    average_gpu_utilization: int | None = None

    gpu_samples_json: str = "[]"
    timeline_json: str = "[]"

    demo: bool = False

    # ── (de)serialization helpers ──────────────────────────────────────────────

    @property
    def gpu_samples(self) -> list[GpuSample]:
        return [GpuSample(**s) for s in json.loads(self.gpu_samples_json or "[]")]

    @gpu_samples.setter
    def gpu_samples(self, samples: list[GpuSample]) -> None:
        self.gpu_samples_json = json.dumps([s.model_dump() for s in samples])

    @property
    def timeline(self) -> list[TimelineEntry]:
        raw = json.loads(self.timeline_json or "[]")
        return [TimelineEntry(**t) for t in raw] if raw else empty_timeline()

    @timeline.setter
    def timeline(self, entries: list[TimelineEntry]) -> None:
        self.timeline_json = json.dumps([t.model_dump(mode="json") for t in entries])

    def to_dto(self, *, output_url: str | None, expose_prompt: bool = True) -> GenerationJob:
        now_ms = _now_ms()
        elapsed = 0.0
        if self.started_at:
            end = self.completed_at or now_ms
            elapsed = max(0.0, (end - self.started_at) / 1000)
        return GenerationJob(
            id=self.job_id,
            prompt_id=self.prompt_id,
            mode=GenerationMode(self.mode),
            prompt=self.prompt if expose_prompt else "",
            negative_prompt=self.negative_prompt if expose_prompt else "",
            settings=GenerationSettings(
                width=self.width,
                height=self.height,
                frames=self.frames,
                fps=self.fps,
                seed=self.seed,
                steps=self.steps,
                guidance=self.guidance,
            ),
            status=GenerationStatus(self.status),
            progress=self.progress,
            current_step=self.current_step,
            total_steps=self.total_steps or self.steps,
            queue_position=self.queue_position,
            created_at=self.created_at,
            started_at=self.started_at,
            completed_at=self.completed_at,
            generation_seconds=self.generation_seconds,
            elapsed_seconds=elapsed,
            output_url=output_url,
            poster_url=None,
            image_url=None,
            error=self.error,
            peak_vram_mb=self.peak_vram_mb,
            average_gpu_utilization=self.average_gpu_utilization,
            gpu_samples=self.gpu_samples,
            timeline=self.timeline,
            demo=self.demo,
        )


def _now_ms() -> int:
    import time

    return int(time.time() * 1000)
