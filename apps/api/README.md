# apps/api — FastAPI gateway

The controlled bridge between the web app and ComfyUI. **Milestones 4–14.**

Right now this is a skeleton: it boots, serves `GET /api/health`, and reports
`demo` for every subsystem. The queue, ComfyUI client, SQLite persistence, GPU
service, and WebSocket streaming land in the backend milestones.

## Run

```bash
cd apps/api
python -m venv .venv && . .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -e ".[dev]"
uvicorn app.main:app --reload --port 8000
```

`GET http://127.0.0.1:8000/api/health` →

```json
{ "api": "online", "comfyui": "demo", "gpu": "demo", "model": "Wan 2.2 TI2V 5B", "demoMode": true, "workflowsLoaded": false }
```

## Planned layout

```
app/
  main.py              # app factory, CORS, router mounts
  config.py            # pydantic-settings — mirrors .env
  models.py            # SQLModel `generations` table
  schemas.py           # Pydantic request/response DTOs (mirror apps/web/lib/types.ts)
  routers/
    health.py  generations.py  gpu.py
  services/
    queue.py           # asyncio.Queue + single GPU worker
    comfyui.py         # is_online / queue_prompt / track_prompt / get_history / get_output / upload_image
    gpu.py             # nvidia-smi parsing
  comfy/
    workflow_map.py    # node-id map for prompt/seed/size/steps substitution
  providers/
    base.py            # VideoInferenceProvider (Phase 7)
    comfyui_provider.py
```

## Endpoints (target)

| Method | Path                                    |
| ------ | --------------------------------------- |
| GET    | `/api/health`                          |
| GET    | `/api/gpu`                             |
| POST   | `/api/generations`                    |
| GET    | `/api/generations`                    |
| GET    | `/api/generations/{job_id}`          |
| WS     | `/api/generations/{job_id}/events`   |
| GET    | `/api/generations/{job_id}/video`   |
| POST   | `/api/generations/{job_id}/cancel`  |
| DELETE | `/api/generations/{job_id}`          |
