"""Synchronous CRUD for `Generation`. Async callers wrap these in
`asyncio.to_thread`."""

from __future__ import annotations

import time
from collections.abc import Callable

from sqlmodel import col, select

from .db import session_scope
from .models import Generation


def now_ms() -> int:
    return int(time.time() * 1000)


def create(row: Generation) -> Generation:
    with session_scope() as s:
        s.add(row)
        s.flush()
        s.refresh(row)
        s.expunge(row)
        return row


def get(job_id: str) -> Generation | None:
    with session_scope() as s:
        row = s.get(Generation, job_id)
        if row is not None:
            s.expunge(row)
        return row


def list_recent(limit: int = 60) -> list[Generation]:
    with session_scope() as s:
        rows = s.exec(
            select(Generation).order_by(col(Generation.created_at).desc()).limit(limit)
        ).all()
        for r in rows:
            s.expunge(r)
        return list(rows)


def update(job_id: str, mutate: Callable[[Generation], None]) -> Generation | None:
    """Load, apply `mutate`, persist, return a detached copy."""
    with session_scope() as s:
        row = s.get(Generation, job_id)
        if row is None:
            return None
        mutate(row)
        s.add(row)
        s.flush()
        s.refresh(row)
        s.expunge(row)
        return row


def delete(job_id: str) -> bool:
    with session_scope() as s:
        row = s.get(Generation, job_id)
        if row is None:
            return False
        s.delete(row)
        return True


def count_active() -> int:
    with session_scope() as s:
        rows = s.exec(
            select(Generation).where(
                col(Generation.status).in_(["queued", "preparing", "loading_model",
                                            "encoding_prompt", "sampling", "decoding", "saving"])
            )
        ).all()
        return len(rows)


def active_queue() -> list[Generation]:
    """Non-terminal jobs, oldest first — used to recompute queue positions."""
    with session_scope() as s:
        rows = s.exec(
            select(Generation)
            .where(
                col(Generation.status).in_(
                    ["queued", "preparing", "loading_model", "encoding_prompt",
                     "sampling", "decoding", "saving"]
                )
            )
            .order_by(col(Generation.created_at).asc())
        ).all()
        for r in rows:
            s.expunge(r)
        return list(rows)
