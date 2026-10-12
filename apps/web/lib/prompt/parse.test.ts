import { describe, expect, it } from "vitest";

import { parsePromptEnhanceResult } from "./parse";

const valid = {
  original: "A fox",
  enhanced: "A fox, cinematic",
  segments: [{ category: "style", preset: "cinematic", text: "cinematic" }],
  skipped: [{ category: "camera", reason: "already_specified" }],
  method: "rules",
  maxChars: 600,
};

describe("parsePromptEnhanceResult", () => {
  it("accepts a well-formed response", () => {
    expect(parsePromptEnhanceResult(valid)).toEqual(valid);
  });

  it("drops unknown extra fields", () => {
    expect(parsePromptEnhanceResult({ ...valid, extra: 1 })).toEqual(valid);
  });

  it.each([
    ["non-object", "nope"],
    ["null", null],
    ["missing enhanced", { ...valid, enhanced: undefined }],
    ["wrong method", { ...valid, method: "llm" }],
    ["bad maxChars", { ...valid, maxChars: "600" }],
    ["segments not a list", { ...valid, segments: {} }],
    ["unknown category", { ...valid, segments: [{ category: "mood", preset: "x", text: "y" }] }],
    ["unknown skip reason", { ...valid, skipped: [{ category: "style", reason: "because" }] }],
  ])("rejects %s", (_name, raw) => {
    expect(() => parsePromptEnhanceResult(raw)).toThrow(/Unexpected prompt-enhance response/);
  });
});
