/**
 * Browser-visible configuration. Values come from `NEXT_PUBLIC_*` env vars and
 * fall back to the conservative RTX 3070 defaults from `.env.example`.
 *
 * The RTX-3070 limits here MUST match `apps/api/app/config.py`. The frontend
 * enforces them for fast feedback; the backend is the real gate.
 */

function bool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  return value === "true" || value === "1";
}

export const config = {
  demoMode: bool(process.env.NEXT_PUBLIC_DEMO_MODE, true),
  apiUrl: process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000",
  comfyuiUrl: process.env.NEXT_PUBLIC_COMFYUI_URL ?? "http://127.0.0.1:8188",
  githubUrl: process.env.NEXT_PUBLIC_GITHUB_URL ?? "https://github.com/OsamaAnsar/motion-atlas",
  modelName: process.env.NEXT_PUBLIC_MODEL_NAME ?? "Wan 2.2 TI2V 5B",
  gpuName: process.env.NEXT_PUBLIC_GPU_NAME ?? "NVIDIA GeForce RTX 3070",
  hasDemoVideo: bool(process.env.NEXT_PUBLIC_HAS_DEMO_VIDEO, false),
  runtime: "ComfyUI",
  hosting: "Self-hosted",
} as const;

/** Hard limits — a config above any of these is rejected before submission. */
export const LIMITS = {
  maxWidth: 832,
  maxHeight: 480,
  maxFrames: 81,
  minFrames: 17,
  maxSteps: 40,
  minSteps: 10,
  maxQueueSize: 5,
  /** Mirrors `GenerationCreate.prompt` max_length on the API. */
  maxPromptChars: 2000,
  maxUploadMb: 10,
  gpuStartVramThresholdMb: 2000,
  vramTotalMb: 8192,
} as const;

/** Allowed generation parameter choices exposed in the UI. */
export const RESOLUTIONS = [
  { label: "640 × 384", width: 640, height: 384, note: "landscape · safest" },
  { label: "832 × 480", width: 832, height: 480, note: "landscape · heavier" },
  { label: "384 × 640", width: 384, height: 640, note: "portrait" },
  { label: "480 × 832", width: 480, height: 832, note: "portrait · heavier" },
] as const;

export const DURATIONS = [
  { label: "Short", frames: 49, note: "~3s @ 16fps" },
  { label: "Medium", frames: 81, note: "~5s @ 16fps" },
] as const;

export const FPS_OPTIONS = [16, 24] as const;

export const DEFAULTS = {
  width: 640,
  height: 384,
  frames: 49,
  fps: 16 as (typeof FPS_OPTIONS)[number],
  steps: 30,
  guidance: 5,
} as const;

export const GUIDANCE_RANGE = { min: 1, max: 10, step: 0.5 } as const;
