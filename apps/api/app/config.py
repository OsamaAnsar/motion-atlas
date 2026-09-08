"""Runtime configuration. Mirrors the repo-root `.env` / `.env.example`."""

from __future__ import annotations

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=(".env", "../../.env"), extra="ignore")

    app_env: str = "development"
    demo_mode: bool = True

    comfyui_url: str = "http://127.0.0.1:8188"
    comfyui_output_dir: str = ""

    database_url: str = "sqlite:///./motion_atlas.db"

    # RTX 3070 safety controls
    max_gpu_workers: int = 1
    max_queue_size: int = 5
    max_upload_mb: int = 10
    max_width: int = 832
    max_height: int = 480
    max_frames: int = 81
    max_steps: int = 40

    default_width: int = 640
    default_height: int = 384
    default_frames: int = 49
    default_fps: int = 16

    gpu_start_vram_threshold_mb: int = 2000
    public_rate_limit: int = 3

    model_name: str = "Wan 2.2 TI2V 5B"


@lru_cache
def get_settings() -> Settings:
    return Settings()
