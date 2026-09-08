from __future__ import annotations


async def test_health_shape(client):
    r = await client.get("/api/health")
    assert r.status_code == 200
    body = r.json()
    assert body["api"] == "online"
    assert body["demoMode"] is True
    assert body["model"]
    assert set(body) >= {"api", "comfyui", "gpu", "model", "demoMode", "workflowsLoaded"}


async def test_gpu_never_500s(client):
    r = await client.get("/api/gpu")
    assert r.status_code == 200
    body = r.json()
    assert "available" in body
    # On CI there is no GPU; the endpoint must still answer cleanly.
    assert isinstance(body["available"], bool)
