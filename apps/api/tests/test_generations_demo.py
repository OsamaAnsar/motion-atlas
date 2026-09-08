from __future__ import annotations

import asyncio


async def _wait_terminal(client, job_id: str, timeout: float = 20.0) -> dict:
    deadline = asyncio.get_event_loop().time() + timeout
    while asyncio.get_event_loop().time() < deadline:
        r = await client.get(f"/api/generations/{job_id}")
        assert r.status_code == 200
        body = r.json()
        if body["status"] in ("completed", "failed", "cancelled"):
            return body
        await asyncio.sleep(0.1)
    raise AssertionError(f"{job_id} did not finish in {timeout}s")


def _payload(sample_settings, **over):
    p = {
        "mode": "text-to-video",
        "prompt": "a calm test clip of drifting clouds",
        "negativePrompt": "",
        "settings": {**sample_settings, **over},
    }
    return p


async def test_demo_generation_end_to_end(client, sample_settings):
    r = await client.post("/api/generations", json=_payload(sample_settings))
    assert r.status_code == 201, r.text
    created = r.json()
    assert created["status"] == "queued"
    job_id = created["jobId"]

    body = await _wait_terminal(client, job_id)
    assert body["status"] == "completed"
    assert body["progress"] == 1.0
    assert body["generationSeconds"] is not None
    assert body["peakVramMb"] and body["peakVramMb"] > 4000
    assert body["averageGpuUtilization"] and body["averageGpuUtilization"] > 50
    assert body["currentStep"] == body["settings"]["steps"]
    assert len(body["gpuSamples"]) > 5
    assert any(t["at"] for t in body["timeline"])
    assert body["demo"] is True

    lst = await client.get("/api/generations")
    assert any(g["id"] == job_id for g in lst.json())


async def test_invalid_config_rejected(client, sample_settings):
    r = await client.post("/api/generations", json=_payload(sample_settings, width=1280, height=720))
    assert r.status_code == 422
    assert r.json()["error"] == "invalid_config"


async def test_queue_full(client, sample_settings):
    # max_queue_size defaults to 5; the 6th active submission is rejected.
    ids = []
    for _ in range(5):
        r = await client.post("/api/generations", json=_payload(sample_settings, steps=12))
        assert r.status_code == 201
        ids.append(r.json()["jobId"])
    r = await client.post("/api/generations", json=_payload(sample_settings))
    assert r.status_code == 429
    assert r.json()["error"] == "queue_full"
    # drain so the fixture teardown is clean
    for job_id in ids:
        await _wait_terminal(client, job_id, timeout=40.0)


async def test_cancel_queued(client, sample_settings):
    first = (await client.post("/api/generations", json=_payload(sample_settings, steps=20))).json()
    second = (await client.post("/api/generations", json=_payload(sample_settings, steps=20))).json()

    r = await client.post(f"/api/generations/{second['jobId']}/cancel")
    assert r.status_code == 202
    body = await _wait_terminal(client, second["jobId"])
    assert body["status"] == "cancelled"
    await _wait_terminal(client, first["jobId"], timeout=40.0)


async def test_delete_generation(client, sample_settings):
    created = (await client.post("/api/generations", json=_payload(sample_settings))).json()
    await _wait_terminal(client, created["jobId"])
    r = await client.delete(f"/api/generations/{created['jobId']}")
    assert r.status_code == 204
    r = await client.get(f"/api/generations/{created['jobId']}")
    assert r.status_code == 404


async def test_cancel_running(client, sample_settings):
    created = (await client.post("/api/generations", json=_payload(sample_settings, steps=30))).json()
    job_id = created["jobId"]
    # let it start
    for _ in range(60):
        body = (await client.get(f"/api/generations/{job_id}")).json()
        if body["status"] not in ("queued",):
            break
        await asyncio.sleep(0.1)
    await client.post(f"/api/generations/{job_id}/cancel")
    body = await _wait_terminal(client, job_id, timeout=30.0)
    assert body["status"] == "cancelled"
