"""Server-side simulation of the ComfyUI + Wan 2.2 pipeline.

Lets the whole stack (API + queue + WebSocket + web app via ApiProvider) run
end-to-end with no GPU. Numbers are plausible RTX 3070 shapes, not measurements.
"""

from __future__ import annotations

import asyncio
import random
import time

from ..models import Generation
from ..schemas import GpuSample, HealthState, empty_timeline
from .base import RunContext, RunOutcome, VideoInferenceProvider

_RUN_STAGES = [
    "preparing",
    "loading_model",
    "encoding_prompt",
    "sampling",
    "decoding",
    "saving",
]


def _clamp(v: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, v))


def _lerp(a: float, b: float, t: float) -> float:
    return a + (b - a) * _clamp(t, 0.0, 1.0)


def _cost_factor(row: Generation) -> float:
    pixels = (row.width * row.height) / (640 * 384)
    frames = row.frames / 49
    steps = row.steps / 30
    return _clamp(pixels * frames * steps, 0.4, 4.0)


def _stage_plan(row: Generation, speed: float) -> list[tuple[str, float]]:
    k = _cost_factor(row)
    per_step = _lerp(0.36, 0.62, (k - 0.4) / 3.6)
    raw = [
        ("preparing", 0.9),
        ("loading_model", 2.6 + k * 0.4),
        ("encoding_prompt", 1.3),
        ("sampling", row.steps * per_step),
        ("decoding", 1.8 + k * 0.5),
        ("saving", 1.1),
    ]
    s = max(0.25, speed)
    return [(name, dur / s) for name, dur in raw]


def _gpu_for_stage(stage: str, p: float, rng: random.Random) -> dict[str, float]:
    j = lambda amp: (rng.random() - 0.5) * 2 * amp  # noqa: E731
    if stage in ("queued", "preparing"):
        return dict(util=_clamp(8 + p * 22 + j(3), 0, 100), vram=_lerp(950, 1500, p),
                    temp=_lerp(42, 46, p), power=_lerp(45, 80, p))
    if stage == "loading_model":
        return dict(util=_clamp(30 + j(10), 0, 100), vram=_lerp(1500, 5400, p) + j(120),
                    temp=_lerp(46, 55, p), power=_lerp(80, 120, p))
    if stage == "encoding_prompt":
        return dict(util=_clamp(58 + j(8), 0, 100), vram=5600 + j(120),
                    temp=_lerp(55, 59, p), power=130 + j(10))
    if stage == "sampling":
        return dict(util=_clamp(93 + j(5), 60, 100),
                    vram=_clamp(_lerp(6900, 7650, p) + j(160), 5000, 8060),
                    temp=_clamp(_lerp(62, 74, p) + j(1.2), 40, 84),
                    power=_clamp(195 + j(18), 120, 230))
    if stage == "decoding":
        return dict(util=_clamp(72 + j(12), 0, 100),
                    vram=_clamp(_lerp(7650, 7950, p) + j(80), 5000, 8100),
                    temp=_clamp(_lerp(74, 71, p) + j(1), 40, 84), power=150 + j(15))
    # saving
    return dict(util=_clamp(22 + j(8), 0, 100), vram=_lerp(7200, 5200, p),
                temp=_lerp(70, 66, p), power=_lerp(110, 70, p))


class DemoInferenceProvider(VideoInferenceProvider):
    kind = "demo"

    async def health(self) -> tuple[HealthState, bool]:
        return HealthState.demo, False

    async def run(self, ctx: RunContext) -> RunOutcome:
        row = ctx.row
        rng = random.Random(row.seed or 1)
        plan = _stage_plan(row, ctx.settings.demo_speed)
        total = sum(d for _, d in plan)
        weights = [d / total for _, d in plan]

        samples: list[GpuSample] = []
        timeline = empty_timeline()
        timeline[0].at = row.created_at
        sampling_util: list[float] = []
        elapsed_w = 0.0

        for i, (stage, dur) in enumerate(plan):
            if ctx.is_cancelled():
                return RunOutcome(gpu_samples=samples, timeline=timeline)

            ctx.emit({"type": "status", "jobId": row.job_id, "status": stage})
            for entry in timeline:
                if entry.status.value == stage and entry.at is None:
                    entry.at = _now_ms()

            substeps = row.steps if stage == "sampling" else max(3, round(dur / 0.45))
            step_ms = dur / substeps
            for s in range(1, substeps + 1):
                await asyncio.sleep(step_ms)
                if ctx.is_cancelled():
                    return RunOutcome(gpu_samples=samples, timeline=timeline)

                sp = s / substeps
                overall = elapsed_w + weights[i] * sp
                g = _gpu_for_stage(stage, sp, rng)
                if stage == "sampling":
                    sampling_util.append(g["util"])
                sample = GpuSample(
                    t=_now_ms(),
                    utilization=round(g["util"]),
                    memory_used_mb=round(g["vram"]),
                    temperature=round(g["temp"]),
                    power_watts=round(g["power"]),
                )
                samples.append(sample)
                if len(samples) > 240:
                    samples.pop(0)

                ctx.emit({
                    "type": "gpu_metrics",
                    "jobId": row.job_id,
                    "metrics": {
                        "available": True,
                        "name": ctx.settings.gpu_name,
                        "utilization": sample.utilization,
                        "memoryUsedMb": sample.memory_used_mb,
                        "memoryTotalMb": 8192,
                        "temperature": sample.temperature,
                        "powerWatts": sample.power_watts,
                    },
                })
                ctx.emit({
                    "type": "progress",
                    "jobId": row.job_id,
                    "progress": round(overall, 4),
                    "step": s if stage == "sampling" else row.current_step,
                    "totalSteps": row.steps,
                    "status": stage,
                })
            elapsed_w += weights[i]

        for entry in timeline:
            if entry.status.value == "completed" and entry.at is None:
                entry.at = _now_ms()

        peak = max((s.memory_used_mb for s in samples), default=0) or None
        avg = round(sum(sampling_util) / len(sampling_util)) if sampling_util else None
        return RunOutcome(
            prompt_id=f"{random.random():.8f}".split(".")[1] + "-demo",
            output_file=None,
            peak_vram_mb=peak,
            average_gpu_utilization=avg,
            gpu_samples=samples,
            timeline=timeline,
        )


def _now_ms() -> int:
    return int(time.time() * 1000)
