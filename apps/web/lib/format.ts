import type { GenerationStage, GenerationStatus } from "./types";

/** 143 → "02:23", 5025 → "1:23:45" */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  const mm = String(minutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** 201 → "3m 21s", 45 → "45s" */
export function formatDurationLong(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  if (s < 60) return `${s}s`;
  const minutes = Math.floor(s / 60);
  const seconds = s % 60;
  return seconds === 0 ? `${minutes}m` : `${minutes}m ${seconds}s`;
}

export function formatVram(mb: number): string {
  return `${(mb / 1024).toFixed(1)} GB`;
}

export function formatRelativeDate(epochMs: number): string {
  const diff = Date.now() - epochMs;
  const min = 60_000;
  const hour = 60 * min;
  const day = 24 * hour;
  if (diff < min) return "just now";
  if (diff < hour) return `${Math.floor(diff / min)}m ago`;
  if (diff < day) return `${Math.floor(diff / hour)}h ago`;
  if (diff < 7 * day) return `${Math.floor(diff / day)}d ago`;
  return new Date(epochMs).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function truncate(text: string, max: number): string {
  const trimmed = text.trim();
  return trimmed.length <= max ? trimmed : `${trimmed.slice(0, max - 1).trimEnd()}…`;
}

export function modeLabel(mode: "text-to-video" | "image-to-video"): string {
  return mode === "text-to-video" ? "Text → Video" : "Image → Video";
}

const STAGE_COPY: Record<GenerationStage, { label: string; hint: string }> = {
  queued: { label: "Queued", hint: "Waiting for the GPU worker" },
  preparing: { label: "Preparing", hint: "Validating config and templating the workflow" },
  loading_model: { label: "Loading model", hint: "Wan 2.2 into VRAM (offloaded)" },
  encoding_prompt: { label: "Encoding prompt", hint: "T5 text encoder" },
  sampling: { label: "Sampling frames", hint: "Diffusion denoising steps" },
  decoding: { label: "VAE decoding", hint: "Latents → RGB frames" },
  saving: { label: "Saving video", hint: "Muxing frames into MP4" },
  completed: { label: "Completed", hint: "Output ready" },
};

export function stageLabel(status: GenerationStatus): string {
  if (status === "failed") return "Failed";
  if (status === "cancelled") return "Cancelled";
  return STAGE_COPY[status].label;
}

export function stageHint(status: GenerationStatus): string {
  if (status === "failed") return "Generation error";
  if (status === "cancelled") return "Stopped before completion";
  return STAGE_COPY[status].hint;
}
