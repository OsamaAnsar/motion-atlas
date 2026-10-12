import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import type {
  CameraMove,
  EnhancedSegment,
  GenerationMode,
  LightingPreset,
  PromptStyle,
  SkippedSegment,
} from "@/lib/types";
import {
  CAMERA_MOVES,
  LIGHTING_PRESETS,
  MAX_PROMPT_CHARS,
  STYLE_PRESETS,
  enhancePrompt,
  normalizeWhitespace,
} from "./enhance";

interface FixtureCase {
  name: string;
  input: {
    prompt: string;
    mode?: GenerationMode;
    style?: PromptStyle;
    camera?: CameraMove;
    lighting?: LightingPreset;
  };
  expected: {
    original: string;
    enhanced: string;
    segments: EnhancedSegment[];
    skipped: SkippedSegment[];
  };
}

// Shared with apps/api/tests/test_prompt_enhancer.py: both ports must agree.
const fixturePath = fileURLToPath(
  new URL("../../../../fixtures/prompt-enhancer.json", import.meta.url),
);
const fixtures = JSON.parse(readFileSync(fixturePath, "utf-8")) as {
  maxChars: number;
  cases: FixtureCase[];
};

describe("shared fixtures (identical to the Python implementation)", () => {
  it("uses the same length cap", () => {
    expect(fixtures.maxChars).toBe(MAX_PROMPT_CHARS);
  });

  it("has cases", () => {
    expect(fixtures.cases.length).toBeGreaterThan(30);
  });

  for (const c of fixtures.cases) {
    it(c.name, () => {
      const r = enhancePrompt(c.input);
      expect(r.original).toBe(c.expected.original);
      expect(r.enhanced).toBe(c.expected.enhanced);
      expect(r.segments).toEqual(c.expected.segments);
      expect(r.skipped).toEqual(c.expected.skipped);
      expect(r.method).toBe("rules");
    });
  }
});

describe("properties", () => {
  const subjects = [
    "A red fox walks through snow",
    "A lighthouse at sunset, slow pan",
    "WALL-E sweeps across the skyline.",
    "x".repeat(560),
  ];
  const modes: GenerationMode[] = ["text-to-video", "image-to-video"];
  const styles: Array<PromptStyle | undefined> = [
    undefined,
    "none",
    ...(Object.keys(STYLE_PRESETS) as PromptStyle[]),
  ];
  const cameras: Array<CameraMove | undefined> = [
    undefined,
    ...(Object.keys(CAMERA_MOVES) as CameraMove[]),
  ];
  const lightings: Array<LightingPreset | undefined> = [
    undefined,
    ...(Object.keys(LIGHTING_PRESETS) as LightingPreset[]),
  ];

  it("is idempotent for every option combination", () => {
    for (const prompt of subjects) {
      for (const mode of modes) {
        for (const style of styles) {
          for (const camera of cameras) {
            for (const lighting of lightings) {
              const opts = { mode, style, camera, lighting };
              const first = enhancePrompt({ prompt, ...opts });
              const again = enhancePrompt({ ...opts, prompt: first.enhanced });
              expect(again.enhanced).toBe(first.enhanced);
              expect(again.segments).toEqual([]);
            }
          }
        }
      }
    }
  });

  it("keeps the subject first and verbatim", () => {
    for (const prompt of subjects) {
      const r = enhancePrompt({ prompt, style: "cinematic", camera: "pan", lighting: "neon" });
      expect(r.enhanced.startsWith(normalizeWhitespace(prompt))).toBe(true);
    }
  });

  it("collapses whitespace", () => {
    expect(enhancePrompt({ prompt: "  A   cat\n\n sits \t here  ", style: "none" }).enhanced).toBe(
      "A cat sits here",
    );
  });

  it("never truncates user text past the cap", () => {
    const prompt = "w".repeat(MAX_PROMPT_CHARS + 50);
    const r = enhancePrompt({ prompt, camera: "pan" });
    expect(r.enhanced).toBe(prompt);
    expect(r.skipped.every((s) => s.reason === "too_long")).toBe(true);
  });

  it("rejects a blank prompt", () => {
    // space, newline, tab, no-break space, space
    const blank = String.fromCharCode(32, 10, 9, 0xa0, 32);
    expect(() => enhancePrompt({ prompt: blank })).toThrow(/empty/);
  });
});
