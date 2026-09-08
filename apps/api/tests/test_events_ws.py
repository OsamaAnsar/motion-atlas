"""WebSocket event stream — uses Starlette's sync TestClient, which manages its
own lifespan (own JobManager). Kept separate from the async httpx tests.
"""

from __future__ import annotations

from starlette.testclient import TestClient


def _payload():
    return {
        "mode": "text-to-video",
        "prompt": "a short test clip",
        "negativePrompt": "",
        "settings": {
            "width": 640,
            "height": 384,
            "frames": 49,
            "fps": 16,
            "seed": 777,
            "steps": 16,
            "guidance": 5,
        },
    }


def test_ws_streams_progress_gpu_and_completion():
    from app.config import get_settings
    from app.main import app

    # Slow the sim down enough that a client reliably observes live events.
    get_settings().demo_speed = 3.0

    with TestClient(app) as tc:
        created = tc.post("/api/generations", json=_payload())
        assert created.status_code == 201
        job_id = created.json()["jobId"]

        seen: list[str] = []
        terminal: str | None = None
        with tc.websocket_connect(f"/api/generations/{job_id}/events") as ws:
            for _ in range(2000):
                msg = ws.receive_json()
                seen.append(msg.get("type"))
                if msg.get("type") in ("completed", "failed"):
                    terminal = msg.get("type")
                    break
                if msg.get("type") == "status" and msg.get("status") in (
                    "completed",
                    "failed",
                    "cancelled",
                ):
                    terminal = msg.get("status")
                    break

    assert "progress" in seen
    assert "gpu_metrics" in seen
    assert terminal == "completed"

    with TestClient(app) as tc:
        final = tc.get(f"/api/generations/{job_id}").json()
    assert final["status"] == "completed"
    assert final["outputUrl"] is None  # demo produces no file
