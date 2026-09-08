"""`VideoInferenceProvider` — the backend seam that lets inference move from a
local ComfyUI to a remote GPU (RunPod / AWS / Lambda) without touching routes,
the queue, or the web app.

Implementations:
  - DemoInferenceProvider  — server-side simulation (no GPU / ComfyUI)
  - ComfyUIProvider        — local ComfyUI + Wan 2.2
"""

from __future__ import annotations

import abc
from collections.abc import Callable
from dataclasses import dataclass, field

from ..config import Settings
from ..models import Generation
from ..schemas import GpuSample, HealthState, TimelineEntry
from ..services.gpu import GpuService


@dataclass
class RunContext:
    row: Generation
    #: Publish a wire-shaped event ({"type": ..., "jobId": ...}). The worker
    #: also mirrors relevant fields into the DB.
    emit: Callable[[dict], None]
    #: True once the user has requested cancellation.
    is_cancelled: Callable[[], bool]
    gpu: GpuService
    settings: Settings


@dataclass
class RunOutcome:
    prompt_id: str | None = None
    #: filename inside `storage/generations/`, or None (demo).
    output_file: str | None = None
    peak_vram_mb: int | None = None
    average_gpu_utilization: int | None = None
    gpu_samples: list[GpuSample] = field(default_factory=list)
    timeline: list[TimelineEntry] = field(default_factory=list)


class VideoInferenceProvider(abc.ABC):
    kind: str = "base"

    @abc.abstractmethod
    async def health(self) -> tuple[HealthState, bool]:
        """Return (comfyui/runtime state, workflows_loaded)."""

    @abc.abstractmethod
    async def run(self, ctx: RunContext) -> RunOutcome:
        """Execute one generation. Emit lifecycle events via `ctx.emit`.

        Must raise `CudaOutOfMemoryError` on OOM and check `ctx.is_cancelled()`
        between steps. Any other exception is turned into a `failed` job by the
        worker; the worker itself survives.
        """
