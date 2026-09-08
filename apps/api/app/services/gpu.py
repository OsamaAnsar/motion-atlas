"""GPU telemetry via `nvidia-smi`. Degrades to `{available: false}` — never raises."""

from __future__ import annotations

import asyncio
import random
import time

from ..config import get_settings
from ..logging import get_logger
from ..schemas import GpuMetrics

log = get_logger("gpu")

_QUERY = (
    "--query-gpu=name,utilization.gpu,memory.used,memory.total,temperature.gpu,power.draw"
)
_FORMAT = "--format=csv,noheader,nounits"


class GpuService:
    """Thin cache around nvidia-smi so many callers within ~1s share one read."""

    def __init__(self, ttl: float = 1.0) -> None:
        self._ttl = ttl
        self._cached: GpuMetrics | None = None
        self._at = 0.0
        self._lock = asyncio.Lock()
        self._settings = get_settings()

    async def read(self, *, force: bool = False) -> GpuMetrics:
        if not force and self._cached and (time.monotonic() - self._at) < self._ttl:
            return self._cached
        async with self._lock:
            if not force and self._cached and (time.monotonic() - self._at) < self._ttl:
                return self._cached
            metrics = await self._probe()
            self._cached = metrics
            self._at = time.monotonic()
            return metrics

    async def free_vram_mb(self) -> int | None:
        m = await self.read()
        if not m.available or m.memory_total_mb == 0:
            return None
        return max(0, m.memory_total_mb - m.memory_used_mb)

    async def _probe(self) -> GpuMetrics:
        try:
            proc = await asyncio.create_subprocess_exec(
                "nvidia-smi",
                _QUERY,
                _FORMAT,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.DEVNULL,
            )
            out, _ = await asyncio.wait_for(proc.communicate(), timeout=2.0)
        except (TimeoutError, FileNotFoundError, OSError) as exc:
            log.debug("nvidia-smi unavailable", extra={"err": str(exc)})
            return self._unavailable()

        line = out.decode("utf-8", "ignore").strip().splitlines()
        if not line:
            return self._unavailable()
        parts = [p.strip() for p in line[0].split(",")]
        if len(parts) < 6:
            return self._unavailable()
        try:
            return GpuMetrics(
                available=True,
                name=parts[0],
                utilization=int(float(parts[1])),
                memory_used_mb=int(float(parts[2])),
                memory_total_mb=int(float(parts[3])),
                temperature=int(float(parts[4])),
                power_watts=int(float(parts[5])),
            )
        except ValueError:
            return self._unavailable()

    def _unavailable(self) -> GpuMetrics:
        # In demo mode, report a plausible *idle* card so the dashboard and the
        # navbar indicator stay coherent between runs. During a run the demo
        # provider streams its own (simulated) gpu_metrics events.
        if self._settings.demo_mode:
            return GpuMetrics(
                available=True,
                name=self._settings.gpu_name,
                utilization=random.randint(1, 6),
                memory_used_mb=random.randint(700, 1200),
                memory_total_mb=8192,
                temperature=random.randint(38, 45),
                power_watts=random.randint(18, 34),
            )
        return GpuMetrics(available=False, name=self._settings.gpu_name)
