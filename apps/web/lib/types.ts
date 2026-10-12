/**
 * Shared domain types. These mirror the FastAPI DTOs (`apps/api/app/schemas.py`)
 * so `MockProvider` and `ApiProvider` are interchangeable.
 */

export type GenerationMode = "text-to-video" | "image-to-video";

/** Ordered lifecycle. `queued` → ... → one of the terminal three. */
export const GENERATION_STAGES = [
  "queued",
  "preparing",
  "loading_model",
  "encoding_prompt",
  "sampling",
  "decoding",
  "saving",
  "completed",
] as const;

export type GenerationStage = (typeof GENERATION_STAGES)[number];

export type GenerationStatus = GenerationStage | "failed" | "cancelled";

export const TERMINAL_STATUSES: readonly GenerationStatus[] = [
  "completed",
  "failed",
  "cancelled",
];

export function isTerminal(status: GenerationStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}

export interface GenerationSettings {
  width: number;
  height: number;
  frames: number;
  fps: number;
  seed: number;
  steps: number;
  guidance: number;
}

export interface GenerationRequest {
  mode: GenerationMode;
  prompt: string;
  negativePrompt: string;
  /** Server-side filename of a previously uploaded image (i2v only). */
  imageName: string | null;
  /** Data URL for local preview only — never persisted. */
  imageDataUrl: string | null;
  settings: GenerationSettings;
}

export interface GpuMetrics {
  available: boolean;
  name: string;
  /** 0–100 */
  utilization: number;
  memoryUsedMb: number;
  memoryTotalMb: number;
  /** °C */
  temperature: number;
  /** Watts */
  powerWatts: number;
}

export interface GpuSample {
  /** epoch ms */
  t: number;
  utilization: number;
  memoryUsedMb: number;
  temperature: number;
  powerWatts: number;
}

export interface TimelineEntry {
  status: GenerationStage;
  label: string;
  /** epoch ms, or null if not reached yet */
  at: number | null;
}

export interface GenerationJob {
  id: string;
  /** ComfyUI prompt_id — null until submitted. */
  promptId: string | null;
  mode: GenerationMode;
  prompt: string;
  negativePrompt: string;
  settings: GenerationSettings;

  status: GenerationStatus;
  /** 0–1. Meaningful during `sampling`; indeterminate elsewhere. */
  progress: number;
  currentStep: number;
  totalSteps: number;
  queuePosition: number | null;

  createdAt: number;
  startedAt: number | null;
  completedAt: number | null;
  generationSeconds: number | null;
  elapsedSeconds: number;

  outputUrl: string | null;
  posterUrl: string | null;
  imageUrl: string | null;

  error: string | null;

  peakVramMb: number | null;
  averageGpuUtilization: number | null;
  gpuSamples: GpuSample[];
  timeline: TimelineEntry[];

  /** Produced by the mock pipeline rather than a real GPU. */
  demo: boolean;
}

export type HealthState = "online" | "offline" | "demo";

export interface HealthStatus {
  api: HealthState;
  comfyui: HealthState;
  gpu: HealthState;
  model: string;
  demoMode: boolean;
  workflowsLoaded: boolean;
}

/** WebSocket-shaped events streamed for a single job. */
export type GenerationEvent =
  | { type: "queued"; jobId: string; queuePosition: number }
  | { type: "started"; jobId: string; promptId: string | null }
  | { type: "status"; jobId: string; status: GenerationStatus }
  | {
      type: "progress";
      jobId: string;
      progress: number;
      step: number;
      totalSteps: number;
      status: GenerationStatus;
    }
  | { type: "gpu_metrics"; jobId: string; metrics: GpuMetrics }
  | { type: "completed"; jobId: string; job: GenerationJob }
  | { type: "failed"; jobId: string; error: string };

// ── prompt enhancer (rule-based, not an LLM) ────────────────────────────────

export type PromptStyle = "cinematic" | "documentary" | "anime" | "product-shot" | "none";
export type CameraMove =
  | "static"
  | "slow-push-in"
  | "pan"
  | "tracking"
  | "aerial"
  | "handheld"
  | "orbit";
export type LightingPreset = "natural" | "golden-hour" | "studio" | "neon" | "dramatic";
export type SegmentCategory = "style" | "camera" | "lighting" | "continuity";
export type SkipReason = "already_specified" | "too_long";

export interface PromptEnhanceRequest {
  prompt: string;
  mode?: GenerationMode;
  /** Omitted: cinematic for text-to-video, nothing for image-to-video. */
  style?: PromptStyle;
  camera?: CameraMove;
  lighting?: LightingPreset;
}

export interface EnhancedSegment {
  category: SegmentCategory;
  preset: string;
  text: string;
}

export interface SkippedSegment {
  category: SegmentCategory;
  reason: SkipReason;
}

export interface PromptEnhanceResult {
  /** The prompt with whitespace normalised (otherwise untouched). */
  original: string;
  enhanced: string;
  segments: EnhancedSegment[];
  skipped: SkippedSegment[];
  /** Always "rules": deterministic text rules, not a language model. */
  method: "rules";
  /** Heuristic length cap in characters (not a measured encoder limit). */
  maxChars: number;
}
