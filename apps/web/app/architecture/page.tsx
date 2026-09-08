import type { Metadata } from "next";

import { config } from "@/lib/config";
import { Container, Eyebrow } from "@/components/primitives";
import { ArchitectureLive } from "@/components/architecture/architecture-live";

export const metadata: Metadata = {
  title: "Architecture",
  description: "How a prompt becomes an MP4 — every component in the Motion Atlas pipeline.",
};

const COMPONENTS = [
  {
    name: "Browser · Next.js",
    detail:
      "App Router UI. Talks only to FastAPI over REST + a WebSocket. A single GenerationProvider interface means the demo (in-browser sim) and the real API are swappable with one env var.",
  },
  {
    name: "FastAPI gateway",
    detail:
      "The only process allowed to reach ComfyUI. Validates every request against the RTX 3070 limits, assigns a queue position, templates a known-good workflow, and streams progress + GPU metrics back.",
  },
  {
    name: "Job Queue (asyncio)",
    detail:
      "A single asyncio.Queue with one worker. MAX_GPU_WORKERS=1 guarantees exactly one generation touches the GPU at a time; everything else waits FIFO. Redis can replace it later without API changes.",
  },
  {
    name: "SQLite",
    detail:
      "One generations table — the reproducible record: fully-resolved request, seed, model, workflow params, timings, output path, peak VRAM. Migrates to Postgres if it ever needs to.",
  },
  {
    name: "GPU metrics",
    detail:
      "nvidia-smi parsed into name / utilization / VRAM / temperature / power. Exposed at GET /api/gpu and pushed as gpu_metrics events during a run. Degrades to { available: false } — never crashes.",
  },
  {
    name: "ComfyUI",
    detail:
      "Runs separately on 127.0.0.1:8188 with low-VRAM flags. Never exposed publicly. The API submits via POST /prompt, tracks execution on /ws by prompt_id, and pulls the output path from /history.",
  },
  {
    name: "Wan 2.2 TI2V 5B",
    detail:
      "Open-source text/image-to-video diffusion model. Offloaded aggressively to fit 8 GB: conservative resolution, short clips, modest step counts.",
  },
  {
    name: "RTX 3070 (8 GB)",
    detail:
      "The hard constraint that shapes every default. CUDA OOM is caught and turned into a readable failed status; the worker survives.",
  },
  {
    name: "MP4 output",
    detail:
      "Detected in ComfyUI's output dir, then served through FastAPI with a streaming response and surfaced in the browser with full metadata.",
  },
];

export default function ArchitecturePage() {
  return (
    <Container className="py-8">
      <div className="mb-6">
        <Eyebrow>Architecture</Eyebrow>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Prompt → MP4</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          A controlled bridge, not a passthrough. {config.modelName} runs locally under ComfyUI; the
          web app only ever speaks to FastAPI.
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-[0.85fr_1.15fr]">
        <div className="lg:sticky lg:top-20 lg:self-start">
          <ArchitectureLive />
        </div>

        <div className="flex flex-col gap-3">
          {COMPONENTS.map((c, i) => (
            <div key={c.name} className="panel p-4">
              <div className="flex items-baseline gap-3">
                <span className="metric text-xs text-accent">{String(i + 1).padStart(2, "0")}</span>
                <div>
                  <h3 className="text-sm font-semibold">{c.name}</h3>
                  <p className="mt-1 text-sm text-muted">{c.detail}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="panel mt-8 p-5">
        <h2 className="text-sm font-semibold">Progress &amp; telemetry paths</h2>
        <div className="mt-3 grid gap-4 font-mono text-xs text-muted sm:grid-cols-3">
          <pre className="whitespace-pre-wrap">{`request
 → Next.js
 → FastAPI
 → queue
 → worker
 → ComfyUI /prompt
 → Wan 2.2 / RTX 3070
 → MP4
 → browser`}</pre>
          <pre className="whitespace-pre-wrap">{`ComfyUI /ws
 → FastAPI
 → WS /api/generations
      /{job_id}/events
 → browser`}</pre>
          <pre className="whitespace-pre-wrap">{`nvidia-smi
 → GPU service
 → GET /api/gpu
 → GPU dashboard`}</pre>
        </div>
      </div>
    </Container>
  );
}
