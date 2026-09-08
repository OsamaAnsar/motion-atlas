/**
 * Seed content for demo mode: a pre-populated gallery plus prompt helper
 * presets. Every job here is deterministic so the detail pages have real
 * (simulated) GPU curves and timelines to render.
 */

import { stageLabel } from "@/lib/format";
import {
  type GenerationJob,
  type GenerationMode,
  type GenerationSettings,
  type GpuSample,
  type TimelineEntry,
  GENERATION_STAGES,
} from "@/lib/types";
import { buildStagePlan, gpuForStage, makeRng } from "@/lib/provider/mock/synthetic";

const RUN_STAGES = [
  "preparing",
  "loading_model",
  "encoding_prompt",
  "sampling",
  "decoding",
  "saving",
] as const;

interface SeedSpec {
  id: string;
  mode: GenerationMode;
  prompt: string;
  negativePrompt: string;
  settings: GenerationSettings;
  poster: string;
  /** minutes ago the job completed */
  agoMin: number;
}

const SEED_SPECS: SeedSpec[] = [
  {
    id: "gen_seed_lahore",
    mode: "text-to-video",
    prompt:
      "A cinematic aerial shot of Lahore at night during rain, neon reflections on wet streets, slow camera movement, volumetric fog, 35mm.",
    negativePrompt: "low quality, watermark, text, jpeg artifacts",
    settings: { width: 640, height: 384, frames: 49, fps: 16, seed: 738214, steps: 30, guidance: 5 },
    poster: "/demo/poster-01.svg",
    agoMin: 14,
  },
  {
    id: "gen_seed_dunes",
    mode: "text-to-video",
    prompt:
      "Drone footage sweeping over orange sand dunes at golden hour, long shadows, wind-blown sand streaming off the ridges.",
    negativePrompt: "blurry, distorted horizon",
    settings: { width: 832, height: 480, frames: 81, fps: 16, seed: 42, steps: 32, guidance: 5.5 },
    poster: "/demo/poster-02.svg",
    agoMin: 63,
  },
  {
    id: "gen_seed_portrait",
    mode: "image-to-video",
    prompt: "The woman slowly turns toward the camera while wind moves her hair, soft rim light.",
    negativePrompt: "extra fingers, warped face",
    settings: { width: 480, height: 832, frames: 49, fps: 24, seed: 991233, steps: 28, guidance: 4.5 },
    poster: "/demo/poster-03.svg",
    agoMin: 190,
  },
  {
    id: "gen_seed_city",
    mode: "text-to-video",
    prompt:
      "A cinematic tracking shot of a sports car driving through a rain-soaked city street at night, reflections on the asphalt, shallow depth of field.",
    negativePrompt: "cartoon, low detail",
    settings: { width: 640, height: 384, frames: 81, fps: 16, seed: 5150, steps: 30, guidance: 5 },
    poster: "/demo/poster-04.svg",
    agoMin: 380,
  },
  {
    id: "gen_seed_forest",
    mode: "text-to-video",
    prompt:
      "Slow push-in through a misty pine forest at dawn, god rays between the trunks, dew on ferns, subtle parallax.",
    negativePrompt: "oversaturated, noise",
    settings: { width: 640, height: 384, frames: 49, fps: 16, seed: 220466, steps: 26, guidance: 5 },
    poster: "/demo/poster-01.svg",
    agoMin: 1490,
  },
  {
    id: "gen_seed_wave",
    mode: "text-to-video",
    prompt:
      "Ultra slow-motion of a turquoise ocean wave curling and breaking, backlit spray, water droplets frozen in air.",
    negativePrompt: "murky water, flat lighting",
    settings: { width: 832, height: 480, frames: 49, fps: 24, seed: 8899, steps: 34, guidance: 6 },
    poster: "/demo/poster-02.svg",
    agoMin: 2880,
  },
];

function buildTimeline(startedAt: number, totalMs: number): TimelineEntry[] {
  // distribute stage marks across the run for a believable timeline
  const fractions = [0, 0.05, 0.32, 0.4, 0.86, 0.96, 1];
  const stageOrder = [...GENERATION_STAGES];
  return stageOrder.map((status, i) => ({
    status,
    label: stageLabel(status),
    at: Math.round(startedAt + totalMs * (fractions[i] ?? 1)),
  }));
}

function buildSamples(settings: GenerationSettings, startedAt: number, totalMs: number): GpuSample[] {
  const rng = makeRng(settings.seed || 1);
  const plan = buildStagePlan(settings, 1);
  const planTotal = plan.reduce((s, p) => s + p.durationMs, 0);
  const samples: GpuSample[] = [];
  let clock = startedAt;
  for (let i = 0; i < RUN_STAGES.length; i += 1) {
    const stage = RUN_STAGES[i]!;
    const dur = ((plan[i]!.durationMs / planTotal) * totalMs) | 0;
    const n = Math.max(3, Math.round(dur / 900));
    for (let s = 1; s <= n; s += 1) {
      const g = gpuForStage(stage, s / n, rng);
      clock += dur / n;
      samples.push({
        t: Math.round(clock),
        utilization: Math.round(g.utilization),
        memoryUsedMb: Math.round(g.memoryUsedMb),
        temperature: Math.round(g.temperature),
        powerWatts: Math.round(g.powerWatts),
      });
    }
  }
  return samples;
}

function specToJob(spec: SeedSpec): GenerationJob {
  const completedAt = Date.now() - spec.agoMin * 60_000;
  const genSeconds = 120 + (spec.settings.frames + spec.settings.steps * 3) * (spec.mode === "image-to-video" ? 1.1 : 1);
  const totalMs = genSeconds * 1000;
  const startedAt = completedAt - totalMs;
  const samples = buildSamples(spec.settings, startedAt, totalMs);
  const peak = samples.reduce((m, s) => Math.max(m, s.memoryUsedMb), 0);
  const samplingUtil = samples.filter((s) => s.memoryUsedMb > 6500).map((s) => s.utilization);
  const avgUtil = samplingUtil.length
    ? Math.round(samplingUtil.reduce((a, b) => a + b, 0) / samplingUtil.length)
    : null;

  return {
    id: spec.id,
    promptId: `${spec.id.slice(4, 12)}-mock`,
    mode: spec.mode,
    prompt: spec.prompt,
    negativePrompt: spec.negativePrompt,
    settings: { ...spec.settings },
    status: "completed",
    progress: 1,
    currentStep: spec.settings.steps,
    totalSteps: spec.settings.steps,
    queuePosition: null,
    createdAt: startedAt - 1500,
    startedAt,
    completedAt,
    generationSeconds: Math.round(genSeconds),
    elapsedSeconds: Math.round(genSeconds),
    outputUrl: null,
    posterUrl: spec.poster,
    imageUrl: null,
    error: null,
    peakVramMb: peak || null,
    averageGpuUtilization: avgUtil,
    gpuSamples: samples,
    timeline: buildTimeline(startedAt, totalMs),
    demo: true,
  };
}

export function seedGalleryJobs(): GenerationJob[] {
  return SEED_SPECS.map(specToJob);
}

// ── prompt helper presets (Phase 5 preview — prompt text only, no hidden params)

export interface PromptPreset {
  id: string;
  label: string;
  /** appended to the user's prompt */
  suffix: string;
}

export const PROMPT_PRESETS: PromptPreset[] = [
  { id: "cinematic", label: "Cinematic", suffix: "cinematic lighting, 35mm, shallow depth of field, film grain" },
  { id: "drone", label: "Drone Shot", suffix: "aerial drone shot, sweeping camera move, wide vista" },
  { id: "anime", label: "Anime", suffix: "anime style, cel shading, expressive, vibrant palette" },
  { id: "product", label: "Product Shot", suffix: "studio product shot, soft box lighting, slow turntable, seamless backdrop" },
  { id: "cyberpunk", label: "Cyberpunk", suffix: "cyberpunk city, neon signage, rain, volumetric haze, night" },
  { id: "nature", label: "Nature", suffix: "natural light, documentary realism, gentle handheld motion" },
];

export const EXAMPLE_PROMPT =
  "A cinematic aerial shot of Lahore at night during rain, neon reflections on wet streets, slow camera movement.";
