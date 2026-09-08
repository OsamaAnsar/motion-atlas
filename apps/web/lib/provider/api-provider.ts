/**
 * ApiProvider — the real transport. Same interface as MockProvider, implemented
 * over `fetch` + `WebSocket` against the FastAPI gateway.
 *
 * The API already speaks the camelCase DTO shape in `@/lib/types`, so mapping is
 * mostly identity — the one fix-up is turning the relative `outputUrl` into an
 * absolute URL the <video> tag can load.
 */

import { config } from "@/lib/config";
import type {
  GenerationEvent,
  GenerationJob,
  GenerationRequest,
  GpuMetrics,
  HealthStatus,
} from "@/lib/types";
import type {
  CreateGenerationResult,
  GenerationProvider,
  UploadResult,
} from "@/lib/provider/types";

const BASE = config.apiUrl.replace(/\/$/, "");
const WS_BASE = BASE.replace(/^http/, "ws");

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { accept: "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    let detail = `${res.status} ${res.statusText}`;
    try {
      const body = (await res.json()) as { detail?: string; error?: string };
      if (body.detail) detail = body.detail;
    } catch {
      /* non-JSON error body */
    }
    throw new Error(detail);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

function absolutize(job: GenerationJob): GenerationJob {
  return {
    ...job,
    outputUrl: job.outputUrl ? `${BASE}${job.outputUrl}` : null,
  };
}

export class ApiProvider implements GenerationProvider {
  readonly kind = "api" as const;

  async health(): Promise<HealthStatus> {
    try {
      return await request<HealthStatus>("/api/health");
    } catch {
      return {
        api: "offline",
        comfyui: "offline",
        gpu: "offline",
        model: config.modelName,
        demoMode: false,
        workflowsLoaded: false,
      };
    }
  }

  async gpu(): Promise<GpuMetrics> {
    try {
      return await request<GpuMetrics>("/api/gpu");
    } catch {
      return {
        available: false,
        name: config.gpuName,
        utilization: 0,
        memoryUsedMb: 0,
        memoryTotalMb: 0,
        temperature: 0,
        powerWatts: 0,
      };
    }
  }

  async createGeneration(req: GenerationRequest): Promise<CreateGenerationResult> {
    return request<CreateGenerationResult>("/api/generations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        mode: req.mode,
        prompt: req.prompt,
        negativePrompt: req.negativePrompt,
        imageName: req.imageName,
        settings: req.settings,
      }),
    });
  }

  async getGeneration(jobId: string): Promise<GenerationJob> {
    return absolutize(await request<GenerationJob>(`/api/generations/${jobId}`));
  }

  async listGenerations(): Promise<GenerationJob[]> {
    const jobs = await request<GenerationJob[]>("/api/generations");
    return jobs.map(absolutize);
  }

  async cancelGeneration(jobId: string): Promise<void> {
    await request<unknown>(`/api/generations/${jobId}/cancel`, { method: "POST" });
  }

  async deleteGeneration(jobId: string): Promise<void> {
    await request<unknown>(`/api/generations/${jobId}`, { method: "DELETE" });
  }

  async uploadImage(file: File): Promise<UploadResult> {
    const form = new FormData();
    form.append("file", file);
    const { name } = await request<{ name: string; url: string }>("/api/uploads", {
      method: "POST",
      body: form,
    });
    return { name, previewUrl: URL.createObjectURL(file) };
  }

  subscribe(jobId: string, onEvent: (event: GenerationEvent) => void): () => void {
    let socket: WebSocket | null = null;
    let closed = false;

    const connect = () => {
      if (closed) return;
      socket = new WebSocket(`${WS_BASE}/api/generations/${jobId}/events`);
      socket.onmessage = (msg) => {
        try {
          const event = JSON.parse(msg.data as string) as GenerationEvent;
          if (event.type === "completed" && event.job) {
            event.job = absolutize(event.job);
          }
          onEvent(event);
        } catch {
          /* ignore malformed frame */
        }
      };
      socket.onclose = () => {
        // The server closes the socket once the job is terminal — that's expected.
      };
    };
    connect();

    return () => {
      closed = true;
      socket?.close();
    };
  }
}
