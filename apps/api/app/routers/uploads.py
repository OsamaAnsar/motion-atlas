from __future__ import annotations

from fastapi import APIRouter, UploadFile
from fastapi.responses import FileResponse

from ..config import get_settings
from ..errors import NotFoundError, UploadRejectedError
from ..schemas import UploadResponse
from ..services import storage

router = APIRouter(tags=["uploads"])
settings = get_settings()


@router.post("/uploads", response_model=UploadResponse)
async def create_upload(file: UploadFile) -> UploadResponse:
    data = await file.read()
    if len(data) > settings.max_upload_mb * 1024 * 1024:
        raise UploadRejectedError(f"Image exceeds {settings.max_upload_mb} MB.")
    name = storage.save_upload(
        data=data,
        content_type=file.content_type,
        original_name=file.filename or "upload",
    )
    return UploadResponse(name=name, url=f"/api/uploads/{name}")


@router.get("/uploads/{name}")
async def read_upload(name: str) -> FileResponse:
    path = storage.upload_path(name)
    if path is None:
        raise NotFoundError("Upload not found.")
    return FileResponse(path)
