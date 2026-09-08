from __future__ import annotations

from fastapi import APIRouter, Depends

from ..schemas import GpuMetrics
from ..services.gpu import GpuService
from . import deps

router = APIRouter(tags=["gpu"])


@router.get("/gpu", response_model=GpuMetrics)
async def gpu(service: GpuService = Depends(deps.gpu_service)) -> GpuMetrics:
    return await service.read()
