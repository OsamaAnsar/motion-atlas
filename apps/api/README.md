# apps/api — FastAPI gateway

The controlled bridge between the web app and ComfyUI. **Milestones 4–14 are
implemented.**

- **Job queue** — one `asyncio` worker (`MAX_GPU_WORKERS=1`), FIFO, live
  `queue_position`, VRAM start-gate, restart recovery.
- **Persistence** — SQLite via SQLModel (`generations` table).
- **GPU telemetry** — `nvidia-smi` parsed, cached, degrades to
  `{available:false}` (idle-simulated in demo mode).
- **Providers** — `VideoInferenceProvider` seam:
  - `DemoInferenceProvider` — server-side simulation (default, no GPU needed).
  - `ComfyUIProvider` — `POST /prompt`, `/ws` tracking by `prompt_id`,
    `/history` output resolution, `/upload/image`, `/interrupt`. Written against
    ComfyUI's documented API; verify with a real workflow before relying on it.
- **Streaming** — `WS /api/generations/{job_id}/events` re-emits normalized
  events (`queued · started · status · progress · gpu_metrics · completed · failed`).
- **Errors** — typed exceptions → `{error, detail}` JSON; CUDA OOM is caught and
  turns a job `failed` without killing the worker.
- **Uploads** — MIME + magic-byte + size validation, UUID names, retention sweep.
- **Rate limiting** — optional per-IP daily cap (`ENABLE_RATE_LIMIT`).

## Run

```bash
cd apps/api
python -m venv .venv && . .venv/Scripts/activate      # bash: source .venv/bin/activate
pip install -e ".[dev]"
uvicorn app.main:app --reload --port 8000             # DEMO_MODE=true by default
```

`GET /api/health` →

```json
{ "api": "online", "comfyui": "demo", "gpu": "demo",
  "model": "Wan 2.2 TI2V 5B", "demoMode": true, "workflowsLoaded": false }
```

Point the web app at it: `NEXT_PUBLIC_DEMO_MODE=false pnpm --filter @motion-atlas/web dev`.

## Checks

```bash
ruff check .
mypy app
pytest -q
```

## Layout

```
app/
  main.py            app factory, lifespan, CORS, rate-limit middleware, router mounts
  config.py          pydantic-settings (mirrors repo-root .env)
  logging.py         one-JSON-line structured logging
  db.py / repository.py / models.py   SQLite + `generations` table
  schemas.py         camelCase DTOs (mirror apps/web/lib/types.ts)
  errors.py          typed domain errors + handler
  services/
    queue.py         JobManager — asyncio.Queue + single worker
    gpu.py           nvidia-smi telemetry
    events.py        per-job pub/sub for the WebSocket
    storage.py       uploads + generated-video files
  providers/
    base.py          VideoInferenceProvider (Phase 7 remote-GPU seam)
    demo.py          server-side simulation
    comfyui.py       ComfyUI + Wan 2.2
  comfy/workflow_map.py   node-id-free workflow templating
  routers/           health · gpu · uploads · generations (REST + WS)
tests/               health, demo end-to-end, queue, cancel, delete, WS stream
```

## Endpoints

| Method | Path                                   |
| ------ | -------------------------------------- |
| GET    | `/api/health`                         |
| GET    | `/api/gpu`                            |
| POST   | `/api/generations`                   |
| GET    | `/api/generations`                   |
| GET    | `/api/generations/{job_id}`         |
| POST   | `/api/generations/{job_id}/cancel`  |
| DELETE | `/api/generations/{job_id}`         |
| GET    | `/api/generations/{job_id}/video`   |
| WS     | `/api/generations/{job_id}/events`  |
| POST   | `/api/uploads`                        |
| GET    | `/api/uploads/{name}`                |
