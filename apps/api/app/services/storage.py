"""Filesystem handling for uploads and generated videos.

Rules: server-generated UUID names only, validate every upload, never execute,
sweep old uploads.
"""

from __future__ import annotations

import shutil
import time
import uuid
from pathlib import Path

from ..config import get_settings
from ..errors import UploadRejectedError
from ..logging import get_logger

log = get_logger("storage")
settings = get_settings()

# magic bytes → canonical extension
_SIGNATURES: list[tuple[bytes, str]] = [
    (b"\x89PNG\r\n\x1a\n", "png"),
    (b"\xff\xd8\xff", "jpg"),
    (b"RIFF", "webp"),  # + 'WEBP' at offset 8, checked below
]
_ALLOWED_CONTENT_TYPES = {"image/png", "image/jpeg", "image/webp"}


def _sniff(data: bytes) -> str | None:
    for sig, ext in _SIGNATURES:
        if data.startswith(sig):
            if ext == "webp" and data[8:12] != b"WEBP":
                continue
            return ext
    return None


def save_upload(*, data: bytes, content_type: str | None, original_name: str) -> str:
    max_bytes = settings.max_upload_mb * 1024 * 1024
    if len(data) == 0:
        raise UploadRejectedError("Empty file.")
    if len(data) > max_bytes:
        raise UploadRejectedError(
            f"Image is {len(data) / 1024 / 1024:.1f} MB — max is {settings.max_upload_mb} MB."
        )
    if content_type and content_type not in _ALLOWED_CONTENT_TYPES:
        raise UploadRejectedError(f"Unsupported content type: {content_type}.")

    ext = _sniff(data)
    if ext is None:
        raise UploadRejectedError("File is not a PNG, JPEG or WEBP image.")

    name = f"{uuid.uuid4().hex}.{ext}"
    dest = settings.uploads_dir / name
    dest.write_bytes(data)
    log.info(
        "upload saved",
        extra={"name": name, "bytes": len(data), "src_ext": Path(original_name).suffix},
    )
    return name


def upload_path(name: str) -> Path | None:
    p = (settings.uploads_dir / Path(name).name).resolve()
    if p.parent != settings.uploads_dir.resolve() or not p.is_file():
        return None
    return p


def generation_video_path(job_id: str) -> Path:
    return settings.generations_dir / f"{job_id}.mp4"


def store_generation_video(job_id: str, source: Path) -> Path:
    dest = generation_video_path(job_id)
    shutil.copy2(source, dest)
    return dest


def delete_generation_files(job_id: str) -> None:
    for p in (
        generation_video_path(job_id),
        settings.generations_dir / f"{job_id}.json",
    ):
        p.unlink(missing_ok=True)


def sweep_uploads(retention_hours: int | None = None) -> int:
    cutoff = time.time() - (retention_hours or settings.upload_retention_hours) * 3600
    removed = 0
    for p in settings.uploads_dir.glob("*"):
        if p.name == ".gitkeep":
            continue
        try:
            if p.stat().st_mtime < cutoff:
                p.unlink()
                removed += 1
        except OSError:
            pass
    if removed:
        log.info("swept uploads", extra={"removed": removed})
    return removed
