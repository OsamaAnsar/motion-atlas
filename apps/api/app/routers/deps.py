"""Shared accessors for objects stashed on `app.state` during lifespan."""

from __future__ import annotations

from fastapi import Request

from ..providers.base import VideoInferenceProvider
from ..services.events import EventBus
from ..services.gpu import GpuService
from ..services.queue import JobManager


def job_manager(request: Request) -> JobManager:
    return request.app.state.job_manager


def event_bus(request: Request) -> EventBus:
    return request.app.state.event_bus


def gpu_service(request: Request) -> GpuService:
    return request.app.state.gpu_service


def provider(request: Request) -> VideoInferenceProvider:
    return request.app.state.provider
