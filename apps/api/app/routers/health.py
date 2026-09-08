from __future__ import annotations

from fastapi import APIRouter, Depends

from ..config import get_settings
from ..providers.base import VideoInferenceProvider
from ..schemas import HealthState, HealthStatus
from ..services.gpu import GpuService
from . import deps

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthStatus)
async def health(
    prov: VideoInferenceProvider = Depends(deps.provider),
    gpu: GpuService = Depends(deps.gpu_service),
) -> HealthStatus:
    settings = get_settings()
    comfy_state, workflows_loaded = await prov.health()
    metrics = await gpu.read()
    if settings.demo_mode:
        gpu_state = HealthState.demo
    else:
        gpu_state = HealthState.online if metrics.available else HealthState.offline
    return HealthStatus(
        api=HealthState.online,
        comfyui=comfy_state,
        gpu=gpu_state,
        model=settings.model_name,
        demo_mode=settings.demo_mode,
        workflows_loaded=workflows_loaded,
    )
