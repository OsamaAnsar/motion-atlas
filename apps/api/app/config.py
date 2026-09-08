"""Runtime configuration. Mirrors the repo-root `.env` / `.env.example`.

The RTX 3070 safety ceilings here are the authoritative gate — the web app
mirrors them for fast feedback, but every request is re-validated against these.
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

# apps/api/app/config.py -> repo root
REPO_ROOT = Path(__file__).resolve().parents[3]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(REPO_ROOT / ".env", Path(".env")),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_env: str = "development"
    demo_mode: bool = True
    # Compress the demo pipeline: durations are divided by this. 1 = realistic.
    demo_speed: float = 1.0

    # ── ComfyUI ──
    comfyui_url: str = "http://127.0.0.1:8188"
    comfyui_output_dir: str = ""

    # ── persistence ──
    database_url: str = "sqlite:///./motion_atlas.db"
    store_prompts: bool = True

    # ── RTX 3070 safety controls ──
    max_gpu_workers: int = 1
    max_queue_size: int = 5
    max_upload_mb: int = 10
    max_width: int = 832
    max_height: int = 480
    max_frames: int = 81
    min_frames: int = 8
    max_steps: int = 40
    min_steps: int = 4

    default_width: int = 640
    default_height: int = 384
    default_frames: int = 49
    default_fps: int = 16

    gpu_start_vram_threshold_mb: int = 2000

    # ── public demo protection ──
    enable_rate_limit: bool = False
    public_rate_limit: int = 3

    # ── misc ──
    model_name: str = "Wan 2.2 TI2V 5B"
    gpu_name: str = "NVIDIA GeForce RTX 3070"
    cors_origins: list[str] = Field(
        default_factory=lambda: ["http://localhost:3000", "http://127.0.0.1:3000"]
    )
    upload_retention_hours: int = 24
    client_id: str = "motion-atlas"

    # ── derived paths ──
    @property
    def storage_dir(self) -> Path:
        return REPO_ROOT / "storage"

    @property
    def generations_dir(self) -> Path:
        return self.storage_dir / "generations"

    @property
    def uploads_dir(self) -> Path:
        return self.storage_dir / "uploads"

    @property
    def workflows_dir(self) -> Path:
        return REPO_ROOT / "comfy" / "workflows"

    @property
    def comfyui_ws_url(self) -> str:
        return self.comfyui_url.replace("http://", "ws://").replace("https://", "wss://")

    @property
    def fps_options(self) -> tuple[int, ...]:
        return (16, 24)


@lru_cache
def get_settings() -> Settings:
    settings = Settings()
    settings.generations_dir.mkdir(parents=True, exist_ok=True)
    settings.uploads_dir.mkdir(parents=True, exist_ok=True)
    return settings
