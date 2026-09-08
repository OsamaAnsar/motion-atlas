"use client";

import { create } from "zustand";

import { DEFAULTS, FPS_OPTIONS, LIMITS } from "@/lib/config";
import { getProvider } from "@/lib/provider/factory";
import { randomSeed } from "@/lib/provider/mock/synthetic";
import {
  type GenerationJob,
  type GenerationMode,
  type GenerationRequest,
  type GpuMetrics,
  type GpuSample,
  type HealthStatus,
  isTerminal,
} from "@/lib/types";

const GPU_HISTORY_LIMIT = 180;

export interface GenerationForm {
  mode: GenerationMode;
  prompt: string;
  negativePrompt: string;
  imageName: string | null;
  imageDataUrl: string | null;
  imageFileName: string | null;
  width: number;
  height: number;
  frames: number;
  fps: number;
  /** null → a fresh random seed on each submit */
  seed: number | null;
  steps: number;
  guidance: number;
}

const INITIAL_FORM: GenerationForm = {
  mode: "text-to-video",
  prompt: "",
  negativePrompt: "",
  imageName: null,
  imageDataUrl: null,
  imageFileName: null,
  width: DEFAULTS.width,
  height: DEFAULTS.height,
  frames: DEFAULTS.frames,
  fps: DEFAULTS.fps,
  seed: null,
  steps: DEFAULTS.steps,
  guidance: DEFAULTS.guidance,
};

function validate(form: GenerationForm): string | null {
  if (form.prompt.trim().length < 3) return "Enter a prompt (at least a few words).";
  if (form.mode === "image-to-video" && !form.imageName)
    return "Upload an image for image-to-video, or switch to text-to-video.";
  if (form.width > LIMITS.maxWidth || form.height > LIMITS.maxHeight)
    return `Resolution exceeds the RTX 3070 limit (${LIMITS.maxWidth}×${LIMITS.maxHeight}).`;
  if (form.frames > LIMITS.maxFrames) return `Frame count exceeds the limit (${LIMITS.maxFrames}).`;
  if (form.frames < LIMITS.minFrames) return `Frame count too low (min ${LIMITS.minFrames}).`;
  if (form.steps > LIMITS.maxSteps || form.steps < LIMITS.minSteps)
    return `Steps must be between ${LIMITS.minSteps} and ${LIMITS.maxSteps}.`;
  if (!FPS_OPTIONS.includes(form.fps as (typeof FPS_OPTIONS)[number])) return "Unsupported FPS.";
  return null;
}

function toRequest(form: GenerationForm): GenerationRequest {
  return {
    mode: form.mode,
    prompt: form.prompt,
    negativePrompt: form.negativePrompt,
    imageName: form.mode === "image-to-video" ? form.imageName : null,
    imageDataUrl: form.mode === "image-to-video" ? form.imageDataUrl : null,
    settings: {
      width: form.width,
      height: form.height,
      frames: form.frames,
      fps: form.fps,
      seed: form.seed ?? randomSeed(),
      steps: form.steps,
      guidance: form.guidance,
    },
  };
}

interface StoreState {
  form: GenerationForm;
  setForm: (patch: Partial<GenerationForm>) => void;
  setResolution: (width: number, height: number) => void;
  resetForm: () => void;

  health: HealthStatus | null;
  gpu: GpuMetrics | null;
  gpuHistory: GpuSample[];
  refreshHealth: () => Promise<void>;
  refreshGpu: () => Promise<void>;

  jobs: Record<string, GenerationJob>;
  history: GenerationJob[];
  activeJobId: string | null;
  loadHistory: () => Promise<void>;
  setActive: (jobId: string | null) => void;

  submitting: boolean;
  formError: string | null;
  submit: () => Promise<string | null>;
  cancel: (jobId: string) => Promise<void>;
  remove: (jobId: string) => Promise<void>;

  _unsub: (() => void) | null;
  watch: (jobId: string) => void;
  unwatch: () => void;
}

export const useStore = create<StoreState>((set, get) => ({
  form: INITIAL_FORM,
  setForm: (patch) => set((s) => ({ form: { ...s.form, ...patch }, formError: null })),
  setResolution: (width, height) => set((s) => ({ form: { ...s.form, width, height } })),
  resetForm: () => set({ form: INITIAL_FORM, formError: null }),

  health: null,
  gpu: null,
  gpuHistory: [],

  refreshHealth: async () => {
    const health = await getProvider().health();
    set({ health });
  },

  refreshGpu: async () => {
    const gpu = await getProvider().gpu();
    set((s) => {
      const sample: GpuSample = {
        t: Date.now(),
        utilization: gpu.utilization,
        memoryUsedMb: gpu.memoryUsedMb,
        temperature: gpu.temperature,
        powerWatts: gpu.powerWatts,
      };
      const gpuHistory = [...s.gpuHistory, sample].slice(-GPU_HISTORY_LIMIT);
      return { gpu, gpuHistory };
    });
  },

  jobs: {},
  history: [],
  activeJobId: null,

  loadHistory: async () => {
    const list = await getProvider().listGenerations();
    set((s) => {
      const jobs = { ...s.jobs };
      for (const job of list) jobs[job.id] = job;
      return { history: list, jobs };
    });
  },

  setActive: (jobId) => set({ activeJobId: jobId }),

  submitting: false,
  formError: null,

  submit: async () => {
    const { form } = get();
    const error = validate(form);
    if (error) {
      set({ formError: error });
      return null;
    }
    set({ submitting: true, formError: null });
    try {
      const provider = getProvider();
      const request = toRequest(form);
      const { jobId } = await provider.createGeneration(request);
      const job = await provider.getGeneration(jobId);
      set((s) => ({ jobs: { ...s.jobs, [jobId]: job }, activeJobId: jobId }));
      get().watch(jobId);
      void get().loadHistory();
      return jobId;
    } catch (err) {
      set({ formError: err instanceof Error ? err.message : "Could not start generation." });
      return null;
    } finally {
      set({ submitting: false });
    }
  },

  cancel: async (jobId) => {
    await getProvider().cancelGeneration(jobId);
    const job = await getProvider().getGeneration(jobId).catch(() => null);
    if (job) set((s) => ({ jobs: { ...s.jobs, [jobId]: job } }));
  },

  remove: async (jobId) => {
    await getProvider().deleteGeneration(jobId);
    set((s) => {
      const jobs = { ...s.jobs };
      delete jobs[jobId];
      return {
        jobs,
        history: s.history.filter((j) => j.id !== jobId),
        activeJobId: s.activeJobId === jobId ? null : s.activeJobId,
      };
    });
  },

  _unsub: null,

  watch: (jobId) => {
    get().unwatch();
    const provider = getProvider();
    const unsub = provider.subscribe(jobId, (event) => {
      if (event.type === "gpu_metrics") {
        set((s) => {
          const sample: GpuSample = {
            t: Date.now(),
            utilization: event.metrics.utilization,
            memoryUsedMb: event.metrics.memoryUsedMb,
            temperature: event.metrics.temperature,
            powerWatts: event.metrics.powerWatts,
          };
          return {
            gpu: event.metrics,
            gpuHistory: [...s.gpuHistory, sample].slice(-GPU_HISTORY_LIMIT),
          };
        });
        return;
      }
      // Any lifecycle event: pull the authoritative job snapshot.
      void provider.getGeneration(jobId).then((job) => {
        set((s) => ({ jobs: { ...s.jobs, [jobId]: job } }));
        if (isTerminal(job.status)) {
          void get().loadHistory();
        }
      });
    });
    set({ _unsub: unsub });
  },

  unwatch: () => {
    const { _unsub } = get();
    if (_unsub) _unsub();
    set({ _unsub: null });
  },
}));

export function activeJob(state: StoreState): GenerationJob | null {
  return state.activeJobId ? (state.jobs[state.activeJobId] ?? null) : null;
}
