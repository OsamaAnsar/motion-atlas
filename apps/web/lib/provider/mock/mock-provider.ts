/**
 * MockProvider — Phase 1 in-browser simulation of the whole generation stack.
 *
 * It implements {@link GenerationProvider} exactly as `ApiProvider` will, so the
 * UI never branches on demo vs. real. State lives in a module singleton so it
 * survives client-side navigation within a session (not across reloads).
 */

import { LIMITS, config } from "@/lib/config";
import { seedGalleryJobs } from "@/lib/demo-data";
import {
  type GenerationEvent,
  type GenerationJob,
  type GenerationRequest,
  type GenerationStage,
  type GpuMetrics,
  type HealthStatus,
  type TimelineEntry,
  GENERATION_STAGES,
  isTerminal,
} from "@/lib/types";
import { stageLabel } from "@/lib/format";
import type {
  CreateGenerationResult,
  GenerationProvider,
  UploadResult,
} from "@/lib/provider/types";
import {
  buildStagePlan,
  coolDown,
  gpuForStage,
  idleGpu,
  makeRng,
  type SimGpu,
} from "./synthetic";

const GPU_NAME = config.gpuName;
const MODEL = config.modelName;
const DEMO_SPEED = Number(process.env.NEXT_PUBLIC_DEMO_SPEED ?? "1") || 1;

const RUN_STAGES: GenerationStage[] = [
  "preparing",
  "loading_model",
  "encoding_prompt",
  "sampling",
  "decoding",
  "saving",
];

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const now = () => Date.now();
const isBrowser = typeof window !== "undefined";

function emptyTimeline(): TimelineEntry[] {
  return GENERATION_STAGES.map((status) => ({
    status,
    label: stageLabel(status),
    at: null,
  }));
}

function simToMetrics(g: SimGpu): GpuMetrics {
  return {
    available: true,
    name: GPU_NAME,
    utilization: Math.round(g.utilization),
    memoryUsedMb: Math.round(g.memoryUsedMb),
    memoryTotalMb: LIMITS.vramTotalMb,
    temperature: Math.round(g.temperature),
    powerWatts: Math.round(g.powerWatts),
  };
}

class MockProvider implements GenerationProvider {
  readonly kind = "mock" as const;

  private jobs = new Map<string, GenerationJob>();
  private queue: string[] = []; // queued + running, FIFO
  private runningId: string | null = null;
  private cancelled = new Set<string>();
  private listeners = new Map<string, Set<(e: GenerationEvent) => void>>();

  private currentGpu: SimGpu = idleGpu(makeRng(1));
  private idleTimer: ReturnType<typeof setInterval> | null = null;
  private seq = 0;

  constructor() {
    for (const job of seedGalleryJobs()) this.jobs.set(job.id, job);
  }

  // ── telemetry ──────────────────────────────────────────────────────────────

  async health(): Promise<HealthStatus> {
    return {
      api: "demo",
      comfyui: "demo",
      gpu: "demo",
      model: MODEL,
      demoMode: true,
      workflowsLoaded: false,
    };
  }

  async gpu(): Promise<GpuMetrics> {
    this.ensureIdleTicker();
    return simToMetrics(this.currentGpu);
  }

  // ── queries ────────────────────────────────────────────────────────────────

  async getGeneration(jobId: string): Promise<GenerationJob> {
    const job = this.jobs.get(jobId);
    if (!job) throw new Error(`Generation ${jobId} not found`);
    return structuredClone(job);
  }

  async listGenerations(): Promise<GenerationJob[]> {
    return [...this.jobs.values()]
      .map((j) => structuredClone(j))
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  // ── mutations ──────────────────────────────────────────────────────────────

  async createGeneration(request: GenerationRequest): Promise<CreateGenerationResult> {
    const activeCount = this.queue.length;
    if (activeCount >= LIMITS.maxQueueSize) {
      throw new Error(
        `Queue is full (${LIMITS.maxQueueSize} max). Wait for a slot before submitting.`,
      );
    }

    const id = `gen_${(now() + this.seq++).toString(36)}${Math.floor(Math.random() * 1e4)
      .toString(36)
      .padStart(3, "0")}`;

    const job: GenerationJob = {
      id,
      promptId: null,
      mode: request.mode,
      prompt: request.prompt.trim(),
      negativePrompt: request.negativePrompt.trim(),
      settings: { ...request.settings },
      status: "queued",
      progress: 0,
      currentStep: 0,
      totalSteps: request.settings.steps,
      queuePosition: null,
      createdAt: now(),
      startedAt: null,
      completedAt: null,
      generationSeconds: null,
      elapsedSeconds: 0,
      outputUrl: null,
      posterUrl: null,
      imageUrl: request.imageDataUrl,
      error: null,
      peakVramMb: null,
      averageGpuUtilization: null,
      gpuSamples: [],
      timeline: emptyTimeline(),
      demo: true,
    };
    this.setTimelineMark(job, "queued", job.createdAt);

    this.jobs.set(id, job);
    this.queue.push(id);
    this.reindexQueue();

    const queuePosition = job.queuePosition ?? 0;
    this.emit(id, { type: "queued", jobId: id, queuePosition });

    void this.pump();
    return { jobId: id, status: "queued", queuePosition };
  }

  async cancelGeneration(jobId: string): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job || isTerminal(job.status)) return;

    if (this.runningId === jobId) {
      this.cancelled.add(jobId);
      return; // run loop finalizes on its next check
    }
    // queued only — drop it
    this.queue = this.queue.filter((qid) => qid !== jobId);
    job.status = "cancelled";
    job.completedAt = now();
    this.emit(jobId, { type: "status", jobId, status: "cancelled" });
    this.reindexQueue();
  }

  async deleteGeneration(jobId: string): Promise<void> {
    if (this.runningId === jobId) {
      this.cancelled.add(jobId);
    }
    this.queue = this.queue.filter((qid) => qid !== jobId);
    this.jobs.delete(jobId);
    this.listeners.delete(jobId);
    this.reindexQueue();
  }

  async uploadImage(file: File): Promise<UploadResult> {
    const previewUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("Could not read image"));
      reader.readAsDataURL(file);
    });
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "png";
    return { name: `upload_${Math.random().toString(36).slice(2, 10)}.${ext}`, previewUrl };
  }

  // ── events ─────────────────────────────────────────────────────────────────

  subscribe(jobId: string, onEvent: (event: GenerationEvent) => void): () => void {
    let set = this.listeners.get(jobId);
    if (!set) {
      set = new Set();
      this.listeners.set(jobId, set);
    }
    set.add(onEvent);

    // Late subscriber: replay current status on next tick.
    const job = this.jobs.get(jobId);
    if (job) {
      queueMicrotask(() => onEvent({ type: "status", jobId, status: job.status }));
    }

    return () => {
      this.listeners.get(jobId)?.delete(onEvent);
    };
  }

  private emit(jobId: string, event: GenerationEvent): void {
    const set = this.listeners.get(jobId);
    if (!set) return;
    for (const cb of set) {
      try {
        cb(event);
      } catch {
        /* a bad listener must not break the pipeline */
      }
    }
  }

  // ── queue worker ───────────────────────────────────────────────────────────

  private reindexQueue(): void {
    let pos = 0;
    for (const qid of this.queue) {
      const job = this.jobs.get(qid);
      if (!job) continue;
      if (qid === this.runningId) {
        job.queuePosition = null;
        continue;
      }
      pos += 1;
      if (job.queuePosition !== pos) {
        job.queuePosition = pos;
        this.emit(qid, { type: "queued", jobId: qid, queuePosition: pos });
      }
    }
  }

  private async pump(): Promise<void> {
    if (!isBrowser) return; // no timers during SSR/build
    if (this.runningId) return;
    const nextId = this.queue.find((qid) => {
      const j = this.jobs.get(qid);
      return j && j.status === "queued";
    });
    if (!nextId) return;

    this.runningId = nextId;
    this.reindexQueue();
    try {
      await this.runJob(nextId);
    } finally {
      this.runningId = null;
      this.queue = this.queue.filter((qid) => {
        const j = this.jobs.get(qid);
        return j && !isTerminal(j.status);
      });
      this.reindexQueue();
      void this.pump();
    }
  }

  private async runJob(jobId: string): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) return;

    const rng = makeRng(job.settings.seed || 1);
    const plan = buildStagePlan(job.settings, DEMO_SPEED);
    const totalMs = plan.reduce((sum, p) => sum + p.durationMs, 0);
    const weights = plan.map((p) => p.durationMs / totalMs);

    job.startedAt = now();
    job.promptId = `${Math.random().toString(36).slice(2, 10)}-mock`;
    this.emit(jobId, { type: "started", jobId, promptId: job.promptId });

    const samplingUtil: number[] = [];
    let elapsedWeight = 0;

    for (let i = 0; i < RUN_STAGES.length; i += 1) {
      const stage = RUN_STAGES[i]!;
      const stagePlan = plan[i]!;
      const stageWeight = weights[i]!;

      if (this.cancelled.has(jobId)) return this.finalizeCancelled(job);

      job.status = stage;
      this.setTimelineMark(job, stage, now());
      this.emit(jobId, { type: "status", jobId, status: stage });

      const subSteps =
        stage === "sampling" ? job.settings.steps : Math.max(3, Math.round(stagePlan.durationMs / 450));
      const stepMs = stagePlan.durationMs / subSteps;

      for (let s = 1; s <= subSteps; s += 1) {
        await sleep(stepMs);
        if (this.cancelled.has(jobId)) return this.finalizeCancelled(job);

        const stageProgress = s / subSteps;
        const overall = elapsedWeight + stageWeight * stageProgress;

        const g = gpuForStage(stage, stageProgress, rng);
        this.currentGpu = g;
        job.gpuSamples.push({
          t: now(),
          utilization: Math.round(g.utilization),
          memoryUsedMb: Math.round(g.memoryUsedMb),
          temperature: Math.round(g.temperature),
          powerWatts: Math.round(g.powerWatts),
        });
        if (job.gpuSamples.length > 240) job.gpuSamples.shift();
        if (stage === "sampling") samplingUtil.push(g.utilization);

        job.progress = Number(overall.toFixed(4));
        job.elapsedSeconds = job.startedAt ? (now() - job.startedAt) / 1000 : 0;
        if (stage === "sampling") {
          job.currentStep = s;
          job.totalSteps = job.settings.steps;
        }

        this.emit(jobId, { type: "gpu_metrics", jobId, metrics: simToMetrics(g) });
        this.emit(jobId, {
          type: "progress",
          jobId,
          progress: job.progress,
          step: stage === "sampling" ? s : job.currentStep,
          totalSteps: job.settings.steps,
          status: stage,
        });
      }
      elapsedWeight += stageWeight;
    }

    // ── done ──
    job.status = "completed";
    job.progress = 1;
    job.completedAt = now();
    job.generationSeconds = job.startedAt ? (job.completedAt - job.startedAt) / 1000 : null;
    job.elapsedSeconds = job.generationSeconds ?? job.elapsedSeconds;
    job.peakVramMb = job.gpuSamples.reduce((m, s) => Math.max(m, s.memoryUsedMb), 0) || null;
    job.averageGpuUtilization = samplingUtil.length
      ? Math.round(samplingUtil.reduce((a, b) => a + b, 0) / samplingUtil.length)
      : null;
    const asset = pickDemoAsset(job.settings.seed);
    job.outputUrl = asset.video;
    job.posterUrl = asset.poster;
    this.setTimelineMark(job, "completed", job.completedAt);

    this.emit(jobId, { type: "status", jobId, status: "completed" });
    this.emit(jobId, { type: "completed", jobId, job: structuredClone(job) });
  }

  private finalizeCancelled(job: GenerationJob): void {
    this.cancelled.delete(job.id);
    job.status = "cancelled";
    job.completedAt = now();
    job.generationSeconds = job.startedAt ? (job.completedAt - job.startedAt) / 1000 : null;
    this.emit(job.id, { type: "status", jobId: job.id, status: "cancelled" });
  }

  private setTimelineMark(job: GenerationJob, status: GenerationStage, at: number): void {
    const entry = job.timeline.find((t) => t.status === status);
    if (entry && entry.at === null) entry.at = at;
  }

  // ── idle GPU drift so the dashboard is alive between runs ───────────────────

  private ensureIdleTicker(): void {
    if (!isBrowser || this.idleTimer) return;
    const rng = makeRng(7);
    this.idleTimer = setInterval(() => {
      if (this.runningId) return; // run loop owns currentGpu
      this.currentGpu = coolDown(this.currentGpu, 0.35);
      const drift = idleGpu(rng);
      this.currentGpu = {
        utilization: this.currentGpu.utilization * 0.5 + drift.utilization * 0.5,
        memoryUsedMb: this.currentGpu.memoryUsedMb * 0.7 + drift.memoryUsedMb * 0.3,
        temperature: this.currentGpu.temperature * 0.7 + drift.temperature * 0.3,
        powerWatts: this.currentGpu.powerWatts * 0.5 + drift.powerWatts * 0.5,
      };
    }, 2000);
  }
}

// Bundled/synthetic output assets. Videos may 404 (see MotionPreview fallback);
// posters are always-present SVGs.
const DEMO_ASSETS = [
  { video: "/demo/atlas-demo.mp4", poster: "/demo/poster-01.svg" },
  { video: "/demo/atlas-demo.mp4", poster: "/demo/poster-02.svg" },
  { video: "/demo/atlas-demo.mp4", poster: "/demo/poster-03.svg" },
  { video: "/demo/atlas-demo.mp4", poster: "/demo/poster-04.svg" },
] as const;

export function pickDemoAsset(seed: number): { video: string | null; poster: string } {
  const entry = DEMO_ASSETS[Math.abs(seed) % DEMO_ASSETS.length]!;
  return { video: config.hasDemoVideo ? entry.video : null, poster: entry.poster };
}

// Module singleton.
let instance: MockProvider | null = null;

export function getMockProvider(): MockProvider {
  if (!instance) instance = new MockProvider();
  return instance;
}
