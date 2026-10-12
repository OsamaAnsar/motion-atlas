/**
 * Remix: re-open the generator pre-filled from a previous generation.
 *
 * The handoff is a query string (`/generate?remix=new&prompt=...&steps=...`)
 * so it survives navigation and reloads and needs no shared state between the
 * gallery, the detail page and the generator. Everything arriving in it is
 * untrusted: {@link parseRemixQuery} validates every value against the same
 * choices and limits the generator controls use, and reports what it had to
 * reject or adjust instead of silently changing it.
 *
 * The source image of an image-to-video generation is never carried over (the
 * app does not keep a reusable reference to it), so `needsImage` is set and the
 * UI asks for a re-upload.
 */

import {
  DEFAULTS,
  DURATIONS,
  FPS_OPTIONS,
  GUIDANCE_RANGE,
  LIMITS,
  RESOLUTIONS,
} from "@/lib/config";
import type { GenerationJob, GenerationMode } from "@/lib/types";

/**
 * Largest seed accepted for "same seed". The generator draws below 2^31 but its
 * custom seed input has no tighter bound, so any JS-safe integer round-trips.
 */
export const MAX_SEED = Number.MAX_SAFE_INTEGER;

export type SeedMode = "same" | "new";

export interface RemixValues {
  mode: GenerationMode;
  prompt: string;
  negativePrompt: string;
  width: number;
  height: number;
  frames: number;
  fps: number;
  steps: number;
  guidance: number;
  /** null: draw a fresh random seed on submit */
  seed: number | null;
}

export interface RemixParseResult {
  values: RemixValues;
  seedMode: SeedMode;
  /** Image-to-video: the source image must be uploaded again. */
  needsImage: boolean;
  /** Human-readable notes about rejected or adjusted values. */
  warnings: string[];
}

type JobForRemix = Pick<GenerationJob, "mode" | "prompt" | "negativePrompt" | "settings">;

/** The query string (without `?`) that remixes `job`. */
export function buildRemixQuery(job: JobForRemix, seedMode: SeedMode): string {
  const s = job.settings;
  const params = new URLSearchParams();
  params.set("remix", seedMode);
  params.set("mode", job.mode);
  if (job.prompt) params.set("prompt", job.prompt);
  if (job.negativePrompt) params.set("neg", job.negativePrompt);
  params.set("w", String(s.width));
  params.set("h", String(s.height));
  params.set("frames", String(s.frames));
  params.set("fps", String(s.fps));
  params.set("steps", String(s.steps));
  params.set("cfg", String(s.guidance));
  if (seedMode === "same") params.set("seed", String(s.seed));
  return params.toString();
}

export function remixHref(job: JobForRemix, seedMode: SeedMode): string {
  return `/generate?${buildRemixQuery(job, seedMode)}`;
}

/** Remix values for an in-memory job, through the same validation as a URL. */
export function remixFromJob(job: JobForRemix, seedMode: SeedMode): RemixParseResult {
  const parsed = parseRemixQuery(new URLSearchParams(buildRemixQuery(job, seedMode)));
  // A query we built ourselves always carries the `remix` marker.
  if (!parsed) throw new Error("remix query was not recognised");
  return parsed;
}

const INT = /^\d+$/;
const NUMBER = /^-?\d+(\.\d+)?$/;

function parseInt10(raw: string | null): number | null {
  if (raw === null) return null;
  const text = raw.trim();
  if (!INT.test(text)) return null;
  const n = Number(text);
  return Number.isSafeInteger(n) ? n : null;
}

function parseNumber(raw: string | null): number | null {
  if (raw === null) return null;
  const text = raw.trim();
  if (!NUMBER.test(text)) return null;
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * Parse and validate a remix query. Returns null when the query is not a remix
 * (no valid `remix=same|new` marker). Never throws.
 */
export function parseRemixQuery(params: Pick<URLSearchParams, "get">): RemixParseResult | null {
  const marker = params.get("remix");
  if (marker !== "same" && marker !== "new") return null;
  const seedMode: SeedMode = marker;
  const warnings: string[] = [];

  // mode
  let mode: GenerationMode = "text-to-video";
  const rawMode = params.get("mode");
  if (rawMode === "text-to-video" || rawMode === "image-to-video") {
    mode = rawMode;
  } else if (rawMode !== null) {
    warnings.push(`Unknown mode "${rawMode}"; using text-to-video.`);
  }

  // prompts
  let prompt = params.get("prompt") ?? "";
  if (Array.from(prompt).length > LIMITS.maxPromptChars) {
    warnings.push(
      `The prompt is longer than ${LIMITS.maxPromptChars} characters and was not applied.`,
    );
    prompt = "";
  } else if (params.get("prompt") === null) {
    warnings.push("The original prompt is not available (it may not have been stored).");
  }
  let negativePrompt = params.get("neg") ?? "";
  if (Array.from(negativePrompt).length > LIMITS.maxPromptChars) {
    warnings.push(
      `The negative prompt is longer than ${LIMITS.maxPromptChars} characters and was not applied.`,
    );
    negativePrompt = "";
  }

  // resolution: must be one of the choices the generator offers
  let width: number = DEFAULTS.width;
  let height: number = DEFAULTS.height;
  const rawW = params.get("w");
  const rawH = params.get("h");
  if (rawW !== null || rawH !== null) {
    const w = parseInt10(rawW);
    const h = parseInt10(rawH);
    const match = RESOLUTIONS.find((r) => r.width === w && r.height === h);
    if (match) {
      width = match.width;
      height = match.height;
    } else {
      warnings.push(
        `Resolution ${rawW ?? "?"} x ${rawH ?? "?"} is not one of the available choices; using ${DEFAULTS.width} x ${DEFAULTS.height}.`,
      );
    }
  }

  // frames: discrete choices
  let frames: number = DEFAULTS.frames;
  const rawFrames = params.get("frames");
  if (rawFrames !== null) {
    const n = parseInt10(rawFrames);
    if (n !== null && DURATIONS.some((d) => d.frames === n)) {
      frames = n;
    } else {
      warnings.push(`${rawFrames} frames is not an available duration; using ${DEFAULTS.frames}.`);
    }
  }

  // fps: discrete choices
  let fps: number = DEFAULTS.fps;
  const rawFps = params.get("fps");
  if (rawFps !== null) {
    const n = parseInt10(rawFps);
    if (n !== null && (FPS_OPTIONS as readonly number[]).includes(n)) {
      fps = n;
    } else {
      warnings.push(`${rawFps} fps is not available; using ${DEFAULTS.fps}.`);
    }
  }

  // steps: integer slider, clamped to its range
  let steps: number = DEFAULTS.steps;
  const rawSteps = params.get("steps");
  if (rawSteps !== null) {
    const n = parseNumber(rawSteps);
    if (n === null) {
      warnings.push(`Steps "${rawSteps}" is not a number; using ${DEFAULTS.steps}.`);
    } else {
      steps = clamp(Math.round(n), LIMITS.minSteps, LIMITS.maxSteps);
      if (steps !== n) {
        warnings.push(
          `Steps ${rawSteps} adjusted to ${steps} (allowed ${LIMITS.minSteps}-${LIMITS.maxSteps}).`,
        );
      }
    }
  }

  // guidance: slider with a step, clamped and snapped
  let guidance: number = DEFAULTS.guidance;
  const rawCfg = params.get("cfg");
  if (rawCfg !== null) {
    const n = parseNumber(rawCfg);
    if (n === null) {
      warnings.push(`Guidance "${rawCfg}" is not a number; using ${DEFAULTS.guidance}.`);
    } else {
      const snapped = Math.round(n / GUIDANCE_RANGE.step) * GUIDANCE_RANGE.step;
      guidance = clamp(snapped, GUIDANCE_RANGE.min, GUIDANCE_RANGE.max);
      if (guidance !== n) {
        warnings.push(
          `Guidance ${rawCfg} adjusted to ${guidance} (allowed ${GUIDANCE_RANGE.min}-${GUIDANCE_RANGE.max} in steps of ${GUIDANCE_RANGE.step}).`,
        );
      }
    }
  }

  // seed: only applied for "same seed"
  let seed: number | null = null;
  if (seedMode === "same") {
    const rawSeed = params.get("seed");
    const n = parseInt10(rawSeed);
    if (n !== null && n <= MAX_SEED) {
      seed = n;
    } else {
      warnings.push(
        rawSeed === null
          ? 'No seed was provided for "same seed"; a new random seed will be used.'
          : `Seed "${rawSeed}" is not a non-negative whole number; a new random seed will be used.`,
      );
    }
  }

  return {
    values: { mode, prompt, negativePrompt, width, height, frames, fps, steps, guidance, seed },
    seedMode,
    needsImage: mode === "image-to-video",
    warnings,
  };
}
