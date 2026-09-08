"""In-process pub/sub for per-job event streams (the WebSocket source).

One publisher (the GPU worker) fans out to N subscribers (WebSocket clients).
Events are plain dicts already in the wire shape.
"""

from __future__ import annotations

import asyncio
from collections import defaultdict
from typing import Any

Event = dict[str, Any]


class EventBus:
    def __init__(self, buffer: int = 256) -> None:
        self._subs: dict[str, set[asyncio.Queue[Event]]] = defaultdict(set)
        self._buffer = buffer

    def subscribe(self, job_id: str) -> asyncio.Queue[Event]:
        q: asyncio.Queue[Event] = asyncio.Queue(maxsize=self._buffer)
        self._subs[job_id].add(q)
        return q

    def unsubscribe(self, job_id: str, q: asyncio.Queue[Event]) -> None:
        subs = self._subs.get(job_id)
        if not subs:
            return
        subs.discard(q)
        if not subs:
            self._subs.pop(job_id, None)

    def publish(self, job_id: str, event: Event) -> None:
        for q in list(self._subs.get(job_id, ())):
            try:
                q.put_nowait(event)
            except asyncio.QueueFull:
                # Drop the oldest, keep the stream live.
                try:
                    q.get_nowait()
                    q.put_nowait(event)
                except (asyncio.QueueEmpty, asyncio.QueueFull):
                    pass

    def has_subscribers(self, job_id: str) -> bool:
        return bool(self._subs.get(job_id))
