/**
 * ApiProvider — Phase 4+. Same interface as MockProvider, implemented over
 * `fetch` + `WebSocket` against the FastAPI gateway.
 *
 * Only `health()` and `gpu()` are wired now (the API skeleton answers those).
 * The generation methods throw until Milestones 4–11 land, so switching
 * `NEXT_PUBLIC_DEMO_MODE=false` prematurely fails loudly instead of silently.
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

const NOT_WIRED = "Real ComfyUI integration is not wired yet (Milestones 4–11). Use DEMO_MODE.";

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${config.apiUrl}${path}`, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`${path} → ${res.status}`);
  return (await res.json()) as T;
}

export class ApiProvider implements GenerationProvider {
  readonly kind = "api" as const;

  async health(): Promise<HealthStatus> {
    try {
      return await getJson<HealthStatus>("/api/health");
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
      return await getJson<GpuMetrics>("/api/gpu");
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

  async createGeneration(_request: GenerationRequest): Promise<CreateGenerationResult> {
    throw new Error(NOT_WIRED);
  }

  async getGeneration(_jobId: string): Promise<GenerationJob> {
    throw new Error(NOT_WIRED);
  }

  async listGenerations(): Promise<GenerationJob[]> {
    return [];
  }

  async cancelGeneration(_jobId: string): Promise<void> {
    throw new Error(NOT_WIRED);
  }

  async deleteGeneration(_jobId: string): Promise<void> {
    throw new Error(NOT_WIRED);
  }

  async uploadImage(_file: File): Promise<UploadResult> {
    throw new Error(NOT_WIRED);
  }

  subscribe(_jobId: string, _onEvent: (event: GenerationEvent) => void): () => void {
    // Phase 10: new WebSocket(`${wsBase}/api/generations/${jobId}/events`)
    return () => {};
  }
}
