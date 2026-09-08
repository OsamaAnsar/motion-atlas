/**
 * Deterministic-ish simulation helpers for the demo pipeline.
 *
 * Nothing here claims to be measured. The `/system` and `/generate` UIs label
 * everything "Demo Mode". Numbers are plausible RTX-3070 shapes, not readings.
 */

import { LIMITS } from "@/lib/config";
import type { GenerationSettings, GenerationStage } from "@/lib/types";

/** mulberry32 — tiny seeded PRNG so a seed reproduces the same curves. */
export function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randomSeed(): number {
  return Math.floor(Math.random() * 2_147_483_647);
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * clamp(t, 0, 1);

/** Relative cost of a config vs. the safe baseline (640×384 · 49f · 30 steps). */
export function costFactor(s: GenerationSettings): number {
  const pixels = (s.width * s.height) / (640 * 384);
  const frames = s.frames / 49;
  const steps = s.steps / 30;
  return clamp(pixels * frames * steps, 0.4, 4);
}

export interface StagePlan {
  stage: GenerationStage;
  /** simulated wall-clock for this stage, ms */
  durationMs: number;
}

/**
 * Build the per-stage timing plan for a run. `speed` > 1 compresses it
 * (dev convenience via NEXT_PUBLIC_DEMO_SPEED).
 */
export function buildStagePlan(settings: GenerationSettings, speed: number): StagePlan[] {
  const k = costFactor(settings);
  const perStepMs = lerp(360, 620, (k - 0.4) / 3.6);
  const raw: StagePlan[] = [
    { stage: "preparing", durationMs: 900 },
    { stage: "loading_model", durationMs: 2600 + k * 400 },
    { stage: "encoding_prompt", durationMs: 1300 },
    { stage: "sampling", durationMs: settings.steps * perStepMs },
    { stage: "decoding", durationMs: 1800 + k * 500 },
    { stage: "saving", durationMs: 1100 },
  ];
  const s = Math.max(0.25, speed);
  return raw.map((p) => ({ stage: p.stage, durationMs: Math.round(p.durationMs / s) }));
}

export interface SimGpu {
  utilization: number;
  memoryUsedMb: number;
  temperature: number;
  powerWatts: number;
}

const IDLE: SimGpu = { utilization: 3, memoryUsedMb: 900, temperature: 41, powerWatts: 26 };

/** GPU shape for a point inside a stage. `p` is 0..1 progress through that stage. */
export function gpuForStage(stage: GenerationStage, p: number, rng: () => number): SimGpu {
  const jitter = (amp: number) => (rng() - 0.5) * 2 * amp;
  switch (stage) {
    case "queued":
    case "preparing":
      return {
        utilization: clamp(8 + p * 22 + jitter(3), 0, 100),
        memoryUsedMb: lerp(950, 1500, p),
        temperature: lerp(42, 46, p),
        powerWatts: lerp(45, 80, p),
      };
    case "loading_model":
      return {
        utilization: clamp(30 + jitter(10), 0, 100),
        memoryUsedMb: lerp(1500, 5400, p) + jitter(120),
        temperature: lerp(46, 55, p),
        powerWatts: lerp(80, 120, p),
      };
    case "encoding_prompt":
      return {
        utilization: clamp(58 + jitter(8), 0, 100),
        memoryUsedMb: 5600 + jitter(120),
        temperature: lerp(55, 59, p),
        powerWatts: 130 + jitter(10),
      };
    case "sampling":
      return {
        utilization: clamp(93 + jitter(5), 60, 100),
        memoryUsedMb: clamp(lerp(6900, 7650, p) + jitter(160), 5000, LIMITS.vramTotalMb - 120),
        temperature: clamp(lerp(62, 74, p) + jitter(1.2), 40, 84),
        powerWatts: clamp(195 + jitter(18), 120, 230),
      };
    case "decoding":
      return {
        utilization: clamp(72 + jitter(12), 0, 100),
        memoryUsedMb: clamp(lerp(7650, 7950, p) + jitter(80), 5000, LIMITS.vramTotalMb - 60),
        temperature: clamp(lerp(74, 71, p) + jitter(1), 40, 84),
        powerWatts: 150 + jitter(15),
      };
    case "saving":
      return {
        utilization: clamp(22 + jitter(8), 0, 100),
        memoryUsedMb: lerp(7200, 5200, p),
        temperature: lerp(70, 66, p),
        powerWatts: lerp(110, 70, p),
      };
    case "completed":
      return IDLE;
  }
}

/** Idle GPU shape for the dashboard when nothing is running. */
export function idleGpu(rng: () => number): SimGpu {
  const jitter = (amp: number) => (rng() - 0.5) * 2 * amp;
  return {
    utilization: clamp(IDLE.utilization + jitter(3), 0, 12),
    memoryUsedMb: clamp(IDLE.memoryUsedMb + jitter(120), 600, 1400),
    temperature: clamp(IDLE.temperature + jitter(1.5), 35, 48),
    powerWatts: clamp(IDLE.powerWatts + jitter(6), 15, 45),
  };
}

/** Cooldown between an active shape and idle, `p` 0..1. */
export function coolDown(from: SimGpu, p: number): SimGpu {
  return {
    utilization: lerp(from.utilization, IDLE.utilization, p),
    memoryUsedMb: lerp(from.memoryUsedMb, IDLE.memoryUsedMb, p),
    temperature: lerp(from.temperature, IDLE.temperature, p),
    powerWatts: lerp(from.powerWatts, IDLE.powerWatts, p),
  };
}
