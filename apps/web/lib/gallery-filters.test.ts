import { describe, expect, it } from "vitest";

import type { GenerationJob, GenerationMode, GenerationStatus } from "@/lib/types";
import {
  DEFAULT_QUERY,
  MAX_SEARCH_CHARS,
  filterGallery,
  isDefaultQuery,
  parseGalleryQuery,
  toGalleryParams,
  type GalleryQuery,
} from "./gallery-filters";

function job(
  id: string,
  over: {
    prompt?: string;
    mode?: GenerationMode;
    status?: GenerationStatus;
    at?: number;
    frames?: number;
    fps?: number;
  } = {},
): GenerationJob {
  return {
    id,
    promptId: null,
    mode: over.mode ?? "text-to-video",
    prompt: over.prompt ?? "a prompt",
    negativePrompt: "",
    settings: {
      width: 640,
      height: 384,
      frames: over.frames ?? 49,
      fps: over.fps ?? 16,
      seed: 1,
      steps: 30,
      guidance: 5,
    },
    status: over.status ?? "completed",
    progress: 1,
    currentStep: 30,
    totalSteps: 30,
    queuePosition: null,
    createdAt: (over.at ?? 1000) - 10,
    startedAt: null,
    completedAt: over.at ?? 1000,
    generationSeconds: null,
    elapsedSeconds: 0,
    outputUrl: null,
    posterUrl: null,
    imageUrl: null,
    error: null,
    peakVramMb: null,
    averageGpuUtilization: null,
    gpuSamples: [],
    timeline: [],
    demo: true,
  };
}

// Video lengths: a 3.06s, b 5.06s, c 2.04s, d 3.375s
const jobs = [
  job("a", { prompt: "A red fox in the snow", at: 3000, frames: 49, fps: 16 }),
  job("b", {
    prompt: "Neon city at night, rain",
    at: 1000,
    frames: 81,
    fps: 16,
    mode: "image-to-video",
  }),
  job("c", {
    prompt: "Fox runs through a neon alley",
    at: 2000,
    frames: 49,
    fps: 24,
    status: "failed",
  }),
  job("d", { prompt: "Ocean wave", at: 4000, frames: 81, fps: 24, status: "cancelled" }),
];
const ids = (list: GenerationJob[]) => list.map((j) => j.id);
const q = (over: Partial<GalleryQuery>): GalleryQuery => ({ ...DEFAULT_QUERY, ...over });

describe("filterGallery", () => {
  it("defaults to newest first and returns everything", () => {
    expect(ids(filterGallery(jobs, DEFAULT_QUERY))).toEqual(["d", "a", "c", "b"]);
  });

  it("does not mutate its input", () => {
    const copy = [...jobs];
    filterGallery(jobs, q({ sort: "oldest" }));
    expect(jobs).toEqual(copy);
  });

  it("sorts oldest first", () => {
    expect(ids(filterGallery(jobs, q({ sort: "oldest" })))).toEqual(["b", "c", "a", "d"]);
  });

  it("sorts by video duration, longest first", () => {
    expect(ids(filterGallery(jobs, q({ sort: "duration" })))).toEqual(["b", "d", "a", "c"]);
  });

  it("breaks duration ties by newest", () => {
    const tied = [job("x", { at: 1, frames: 49 }), job("y", { at: 2, frames: 49 })];
    expect(ids(filterGallery(tied, q({ sort: "duration" })))).toEqual(["y", "x"]);
  });

  it("filters by status", () => {
    expect(ids(filterGallery(jobs, q({ status: "failed" })))).toEqual(["c"]);
    expect(ids(filterGallery(jobs, q({ status: "cancelled" })))).toEqual(["d"]);
    expect(ids(filterGallery(jobs, q({ status: "completed" })))).toEqual(["a", "b"]);
  });

  it("filters by mode", () => {
    expect(ids(filterGallery(jobs, q({ mode: "image-to-video" })))).toEqual(["b"]);
    expect(ids(filterGallery(jobs, q({ mode: "text-to-video" })))).toEqual(["d", "a", "c"]);
  });

  it("searches the prompt case-insensitively", () => {
    expect(ids(filterGallery(jobs, q({ q: "FOX" })))).toEqual(["a", "c"]);
  });

  it("requires every term (AND), in any order", () => {
    expect(ids(filterGallery(jobs, q({ q: "neon fox" })))).toEqual(["c"]);
    expect(ids(filterGallery(jobs, q({ q: "fox neon" })))).toEqual(["c"]);
    expect(ids(filterGallery(jobs, q({ q: "fox ocean" })))).toEqual([]);
  });

  it("treats regex characters literally", () => {
    expect(ids(filterGallery(jobs, q({ q: ".*" })))).toEqual([]);
    expect(ids(filterGallery(jobs, q({ q: "rain)" })))).toEqual([]);
  });

  it("combines filters and sort", () => {
    const r = filterGallery(jobs, q({ q: "fox", mode: "text-to-video", sort: "oldest" }));
    expect(ids(r)).toEqual(["c", "a"]);
  });

  it("returns an empty list when nothing matches", () => {
    expect(filterGallery(jobs, q({ q: "zebra" }))).toEqual([]);
    expect(filterGallery([], DEFAULT_QUERY)).toEqual([]);
  });
});

describe("parseGalleryQuery", () => {
  const parse = (s: string) => parseGalleryQuery(new URLSearchParams(s));

  it("returns the defaults for an empty query", () => {
    expect(parse("")).toEqual(DEFAULT_QUERY);
  });

  it("reads every field", () => {
    expect(parse("q=red+fox&status=failed&mode=image-to-video&sort=duration")).toEqual({
      q: "red fox",
      status: "failed",
      mode: "image-to-video",
      sort: "duration",
    });
  });

  it("falls back per field on invalid values", () => {
    expect(parse("status=bogus&mode=x&sort=random&q=ok")).toEqual({ ...DEFAULT_QUERY, q: "ok" });
  });

  it("normalises whitespace and caps the search length", () => {
    expect(parse("q=%20%20a%20%20%20b%20").q).toBe("a b");
    expect(parse(`q=${"z".repeat(MAX_SEARCH_CHARS + 50)}`).q.length).toBe(MAX_SEARCH_CHARS);
  });
});

describe("toGalleryParams", () => {
  it("omits defaults", () => {
    expect(toGalleryParams(DEFAULT_QUERY).toString()).toBe("");
    expect(isDefaultQuery(DEFAULT_QUERY)).toBe(true);
    expect(isDefaultQuery(q({ q: "   " }))).toBe(true);
  });

  it("round trips through the parser", () => {
    const query: GalleryQuery = {
      q: "a & b = c",
      status: "cancelled",
      mode: "text-to-video",
      sort: "oldest",
    };
    expect(parseGalleryQuery(toGalleryParams(query))).toEqual(query);
    expect(isDefaultQuery(query)).toBe(false);
  });
});
