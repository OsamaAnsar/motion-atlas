import { describe, expect, it } from "vitest";

import { DEFAULTS, GUIDANCE_RANGE, LIMITS } from "@/lib/config";
import type { GenerationSettings } from "@/lib/types";
import { MAX_SEED, buildRemixQuery, parseRemixQuery, remixFromJob, remixHref } from "./remix";

function q(query: string) {
  return parseRemixQuery(new URLSearchParams(query));
}

const settings: GenerationSettings = {
  width: 832,
  height: 480,
  frames: 81,
  fps: 24,
  seed: 738214,
  steps: 32,
  guidance: 5.5,
};
const job = {
  mode: "text-to-video" as const,
  prompt: 'A fox & a crow; "quoted" 100% #1 + more',
  negativePrompt: "blurry, text",
  settings,
};

describe("parseRemixQuery: marker", () => {
  it("is null without a valid remix marker", () => {
    expect(q("")).toBeNull();
    expect(q("prompt=hi")).toBeNull();
    expect(q("remix=yes&prompt=hi")).toBeNull();
    expect(q("remix=")).toBeNull();
  });
});

describe("round trip", () => {
  it("new seed: carries every setting and drops the seed", () => {
    const r = remixFromJob(job, "new");
    expect(r.warnings).toEqual([]);
    expect(r.seedMode).toBe("new");
    expect(r.needsImage).toBe(false);
    expect(r.values).toEqual({
      mode: "text-to-video",
      prompt: job.prompt,
      negativePrompt: job.negativePrompt,
      width: 832,
      height: 480,
      frames: 81,
      fps: 24,
      steps: 32,
      guidance: 5.5,
      seed: null,
    });
    expect(buildRemixQuery(job, "new")).not.toContain("seed=");
  });

  it("same seed: carries the seed", () => {
    const r = remixFromJob(job, "same");
    expect(r.warnings).toEqual([]);
    expect(r.values.seed).toBe(738214);
  });

  it("survives URL encoding of awkward prompt text", () => {
    const href = remixHref(job, "same");
    expect(href.startsWith("/generate?")).toBe(true);
    const r = q(href.slice("/generate?".length));
    expect(r?.values.prompt).toBe(job.prompt);
  });

  it("flags image-to-video as needing a re-upload", () => {
    const r = remixFromJob({ ...job, mode: "image-to-video" }, "new");
    expect(r.needsImage).toBe(true);
    expect(r.values.mode).toBe("image-to-video");
  });

  it("keeps portrait resolutions", () => {
    const r = remixFromJob({ ...job, settings: { ...settings, width: 480, height: 832 } }, "new");
    expect(r.values.width).toBe(480);
    expect(r.values.height).toBe(832);
    expect(r.warnings).toEqual([]);
  });
});

describe("validation", () => {
  const base = "remix=new&prompt=hello";

  it("rejects a resolution that is not offered, keeping the default", () => {
    const r = q(`${base}&w=1280&h=720`);
    expect(r?.values.width).toBe(DEFAULTS.width);
    expect(r?.values.height).toBe(DEFAULTS.height);
    expect(r?.warnings.join(" ")).toMatch(/Resolution/);
  });

  it("rejects half a resolution", () => {
    const r = q(`${base}&w=832`);
    expect(r?.values.width).toBe(DEFAULTS.width);
    expect(r?.warnings.length).toBe(1);
  });

  it("rejects frames and fps that are not offered", () => {
    const r = q(`${base}&frames=60&fps=30`);
    expect(r?.values.frames).toBe(DEFAULTS.frames);
    expect(r?.values.fps).toBe(DEFAULTS.fps);
    expect(r?.warnings.length).toBe(2);
  });

  it("clamps steps into range and reports it", () => {
    expect(q(`${base}&steps=500`)?.values.steps).toBe(LIMITS.maxSteps);
    expect(q(`${base}&steps=1`)?.values.steps).toBe(LIMITS.minSteps);
    expect(q(`${base}&steps=500`)?.warnings.length).toBe(1);
    expect(q(`${base}&steps=25`)?.warnings).toEqual([]);
  });

  it("rounds fractional steps", () => {
    expect(q(`${base}&steps=25.6`)?.values.steps).toBe(26);
  });

  it("clamps and snaps guidance", () => {
    expect(q(`${base}&cfg=99`)?.values.guidance).toBe(GUIDANCE_RANGE.max);
    expect(q(`${base}&cfg=-3`)?.values.guidance).toBe(GUIDANCE_RANGE.min);
    expect(q(`${base}&cfg=5.3`)?.values.guidance).toBe(5.5);
    expect(q(`${base}&cfg=5.5`)?.warnings).toEqual([]);
  });

  it.each(["abc", "", "NaN", "Infinity", "1e3", "0x10", "--5"])(
    "rejects non-numeric steps/guidance %j",
    (bad) => {
      const r = q(`${base}&steps=${bad}&cfg=${bad}`);
      expect(r?.values.steps).toBe(DEFAULTS.steps);
      expect(r?.values.guidance).toBe(DEFAULTS.guidance);
      expect(r?.warnings.length).toBe(2);
    },
  );

  it("ignores the seed for new-seed remixes", () => {
    expect(q("remix=new&prompt=hi&seed=123")?.values.seed).toBeNull();
  });

  it("accepts a valid seed for same-seed remixes", () => {
    expect(q("remix=same&prompt=hi&seed=0")?.values.seed).toBe(0);
    expect(q(`remix=same&prompt=hi&seed=${MAX_SEED}`)?.values.seed).toBe(MAX_SEED);
  });

  it.each(["-1", "1.5", "abc", "", "99999999999999999999"])(
    "rejects invalid same-seed value %j and falls back to a random seed",
    (bad) => {
      const r = q(`remix=same&prompt=hi&seed=${bad}`);
      expect(r?.values.seed).toBeNull();
      expect(r?.warnings.join(" ")).toMatch(/seed/i);
    },
  );

  it("warns when same-seed has no seed at all", () => {
    const r = q("remix=same&prompt=hi");
    expect(r?.values.seed).toBeNull();
    expect(r?.warnings.length).toBe(1);
  });

  it("falls back to text-to-video for an unknown mode", () => {
    const r = q(`${base}&mode=video-to-video`);
    expect(r?.values.mode).toBe("text-to-video");
    expect(r?.needsImage).toBe(false);
    expect(r?.warnings.length).toBe(1);
  });

  it("rejects an over-long prompt rather than truncating it", () => {
    const r = q(`remix=new&prompt=${"a".repeat(LIMITS.maxPromptChars + 1)}`);
    expect(r?.values.prompt).toBe("");
    expect(r?.warnings.join(" ")).toMatch(/longer than/);
  });

  it("accepts a prompt exactly at the limit", () => {
    const r = q(`remix=new&prompt=${"a".repeat(LIMITS.maxPromptChars)}`);
    expect(Array.from(r?.values.prompt ?? "").length).toBe(LIMITS.maxPromptChars);
    expect(r?.warnings).toEqual([]);
  });

  it("warns when the prompt is missing and leaves it empty", () => {
    const r = q("remix=new");
    expect(r?.values.prompt).toBe("");
    expect(r?.warnings.join(" ")).toMatch(/prompt/i);
  });

  it("ignores unknown parameters", () => {
    const r = q(`${base}&evil=1&__proto__=x`);
    expect(r?.warnings).toEqual([]);
  });
});
