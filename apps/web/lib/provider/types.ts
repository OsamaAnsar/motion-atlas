import type {
  GenerationEvent,
  GenerationJob,
  GenerationRequest,
  GenerationStatus,
  GpuMetrics,
  HealthStatus,
  PromptEnhanceRequest,
  PromptEnhanceResult,
} from "@/lib/types";

export interface CreateGenerationResult {
  jobId: string;
  status: GenerationStatus;
  queuePosition: number;
}

export interface UploadResult {
  /** Server-side reference to store on the request as `imageName`. */
  name: string;
  /** Local preview URL (object URL or data URL). */
  previewUrl: string;
}

/**
 * The single seam between the UI and "how videos actually get made".
 *
 * - `MockProvider`  — Phase 1, runs in the browser.
 * - `ApiProvider`   — Phase 4+, same methods over fetch + WebSocket to FastAPI.
 *
 * The UI imports {@link getProvider} and nothing else from this folder.
 */
export interface GenerationProvider {
  readonly kind: "mock" | "api";

  health(): Promise<HealthStatus>;
  gpu(): Promise<GpuMetrics>;

  createGeneration(request: GenerationRequest): Promise<CreateGenerationResult>;
  getGeneration(jobId: string): Promise<GenerationJob>;
  listGenerations(): Promise<GenerationJob[]>;
  cancelGeneration(jobId: string): Promise<void>;
  deleteGeneration(jobId: string): Promise<void>;

  uploadImage(file: File): Promise<UploadResult>;

  /**
   * Rule-based prompt enhancement (deterministic text rules, not an LLM).
   * `MockProvider` runs the shared TypeScript port; `ApiProvider` calls
   * `POST /api/prompts/enhance`. Rejects on a blank prompt.
   */
  enhancePrompt(request: PromptEnhanceRequest): Promise<PromptEnhanceResult>;

  /**
   * Subscribe to the event stream for one job. Returns an unsubscribe fn.
   * Mirrors `WS /api/generations/{job_id}/events`.
   */
  subscribe(jobId: string, onEvent: (event: GenerationEvent) => void): () => void;
}
