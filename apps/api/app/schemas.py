"""Pydantic DTOs. JSON is camelCase to match `apps/web/lib/types.ts`; Python
attributes stay snake_case. All timestamps are epoch milliseconds (parity with
the browser's `Date.now()`).
"""

from __future__ import annotations

from enum import Enum
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel


class CamelModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class GenerationMode(str, Enum):
    text_to_video = "text-to-video"
    image_to_video = "image-to-video"


class GenerationStatus(str, Enum):
    queued = "queued"
    preparing = "preparing"
    loading_model = "loading_model"
    encoding_prompt = "encoding_prompt"
    sampling = "sampling"
    decoding = "decoding"
    saving = "saving"
    completed = "completed"
    failed = "failed"
    cancelled = "cancelled"


STAGE_ORDER: list[GenerationStatus] = [
    GenerationStatus.queued,
    GenerationStatus.preparing,
    GenerationStatus.loading_model,
    GenerationStatus.encoding_prompt,
    GenerationStatus.sampling,
    GenerationStatus.decoding,
    GenerationStatus.saving,
    GenerationStatus.completed,
]

TERMINAL: set[GenerationStatus] = {
    GenerationStatus.completed,
    GenerationStatus.failed,
    GenerationStatus.cancelled,
}


class HealthState(str, Enum):
    online = "online"
    offline = "offline"
    demo = "demo"


class GpuMetrics(CamelModel):
    available: bool
    name: str
    utilization: int = 0
    memory_used_mb: int = 0
    memory_total_mb: int = 0
    temperature: int = 0
    power_watts: int = 0


class GpuSample(CamelModel):
    t: int
    utilization: int
    memory_used_mb: int
    temperature: int
    power_watts: int


class TimelineEntry(CamelModel):
    status: GenerationStatus
    label: str
    at: int | None = None


class GenerationSettings(CamelModel):
    width: int
    height: int
    frames: int
    fps: int
    seed: int
    steps: int
    guidance: float


class GenerationCreate(CamelModel):
    mode: GenerationMode = GenerationMode.text_to_video
    prompt: str = Field(min_length=1, max_length=2000)
    negative_prompt: str = ""
    image_name: str | None = None
    settings: GenerationSettings


class CreateGenerationResponse(CamelModel):
    job_id: str
    status: GenerationStatus
    queue_position: int


class GenerationJob(CamelModel):
    id: str
    prompt_id: str | None = None
    mode: GenerationMode
    prompt: str
    negative_prompt: str
    settings: GenerationSettings

    status: GenerationStatus
    progress: float = 0.0
    current_step: int = 0
    total_steps: int = 0
    queue_position: int | None = None

    created_at: int
    started_at: int | None = None
    completed_at: int | None = None
    generation_seconds: float | None = None
    elapsed_seconds: float = 0.0

    output_url: str | None = None
    poster_url: str | None = None
    image_url: str | None = None

    error: str | None = None

    peak_vram_mb: int | None = None
    average_gpu_utilization: int | None = None
    gpu_samples: list[GpuSample] = Field(default_factory=list)
    timeline: list[TimelineEntry] = Field(default_factory=list)

    demo: bool = False


class HealthStatus(CamelModel):
    api: HealthState
    comfyui: HealthState
    gpu: HealthState
    model: str
    demo_mode: bool
    workflows_loaded: bool


class UploadResponse(CamelModel):
    name: str
    url: str


STAGE_LABELS: dict[GenerationStatus, str] = {
    GenerationStatus.queued: "Queued",
    GenerationStatus.preparing: "Preparing",
    GenerationStatus.loading_model: "Loading model",
    GenerationStatus.encoding_prompt: "Encoding prompt",
    GenerationStatus.sampling: "Sampling frames",
    GenerationStatus.decoding: "VAE decoding",
    GenerationStatus.saving: "Saving video",
    GenerationStatus.completed: "Completed",
    GenerationStatus.failed: "Failed",
    GenerationStatus.cancelled: "Cancelled",
}


def empty_timeline() -> list[TimelineEntry]:
    return [
        TimelineEntry(status=s, label=STAGE_LABELS[s], at=None)
        for s in STAGE_ORDER
    ]


# ── prompt enhancer (rule-based, not an LLM) ────────────────────────────────


class PromptStyle(str, Enum):
    cinematic = "cinematic"
    documentary = "documentary"
    anime = "anime"
    product_shot = "product-shot"
    none = "none"


class CameraMove(str, Enum):
    static = "static"
    slow_push_in = "slow-push-in"
    pan = "pan"
    tracking = "tracking"
    aerial = "aerial"
    handheld = "handheld"
    orbit = "orbit"


class LightingPreset(str, Enum):
    natural = "natural"
    golden_hour = "golden-hour"
    studio = "studio"
    neon = "neon"
    dramatic = "dramatic"


class SegmentCategory(str, Enum):
    style = "style"
    camera = "camera"
    lighting = "lighting"
    continuity = "continuity"


class SkipReason(str, Enum):
    already_specified = "already_specified"
    too_long = "too_long"


class PromptEnhanceRequest(CamelModel):
    # Length / blank checks live in the router so errors use the API's
    # `{error, detail}` shape.
    prompt: str
    mode: GenerationMode = GenerationMode.text_to_video
    # Omitted: cinematic for text-to-video, nothing for image-to-video.
    style: PromptStyle | None = None
    camera: CameraMove | None = None
    lighting: LightingPreset | None = None


class EnhancedSegment(CamelModel):
    category: SegmentCategory
    preset: str
    text: str


class SkippedSegment(CamelModel):
    category: SegmentCategory
    reason: SkipReason


class PromptEnhanceResponse(CamelModel):
    original: str
    enhanced: str
    segments: list[EnhancedSegment]
    skipped: list[SkippedSegment]
    method: Literal["rules"] = "rules"
    max_chars: int
