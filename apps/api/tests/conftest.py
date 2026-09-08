from __future__ import annotations

import os
import tempfile
from collections.abc import AsyncIterator
from pathlib import Path

import pytest
import pytest_asyncio

# Configure the environment before anything imports app.config.
_TMP = tempfile.mkdtemp(prefix="motion-atlas-test-")
os.environ.update(
    APP_ENV="test",
    DEMO_MODE="true",
    DEMO_SPEED="60",  # compress the simulated pipeline hard
    DATABASE_URL=f"sqlite:///{Path(_TMP) / 'test.db'}",
    ENABLE_RATE_LIMIT="false",
)


@pytest_asyncio.fixture
async def client() -> AsyncIterator[httpx.AsyncClient]:  # noqa: F821
    import httpx

    from app.config import get_settings
    from app.main import app

    get_settings.cache_clear()

    transport = httpx.ASGITransport(app=app)
    async with app.router.lifespan_context(app):
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as c:
            yield c


@pytest.fixture
def sample_settings() -> dict:
    return {
        "width": 640,
        "height": 384,
        "frames": 49,
        "fps": 16,
        "seed": 12345,
        "steps": 12,
        "guidance": 5,
    }
