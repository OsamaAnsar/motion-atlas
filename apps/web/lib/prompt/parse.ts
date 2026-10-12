/**
 * Typed parsing of `POST /api/prompts/enhance` responses. The web app does not
 * trust network data: anything off-shape throws instead of reaching the UI.
 */

import type {
  EnhancedSegment,
  PromptEnhanceResult,
  SegmentCategory,
  SkipReason,
  SkippedSegment,
} from "@/lib/types";

const CATEGORIES: readonly SegmentCategory[] = ["style", "camera", "lighting", "continuity"];
const REASONS: readonly SkipReason[] = ["already_specified", "too_long"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function fail(what: string): never {
  throw new Error(`Unexpected prompt-enhance response: ${what}`);
}

function category(value: unknown): SegmentCategory {
  if (typeof value === "string" && (CATEGORIES as readonly string[]).includes(value)) {
    return value as SegmentCategory;
  }
  return fail("category");
}

function parseSegment(value: unknown): EnhancedSegment {
  if (!isRecord(value)) return fail("segment");
  const { preset, text } = value;
  if (typeof preset !== "string" || typeof text !== "string") return fail("segment fields");
  return { category: category(value.category), preset, text };
}

function parseSkipped(value: unknown): SkippedSegment {
  if (!isRecord(value)) return fail("skipped entry");
  const reason = value.reason;
  if (typeof reason !== "string" || !(REASONS as readonly string[]).includes(reason)) {
    return fail("skip reason");
  }
  return { category: category(value.category), reason: reason as SkipReason };
}

export function parsePromptEnhanceResult(raw: unknown): PromptEnhanceResult {
  if (!isRecord(raw)) return fail("not an object");
  const { original, enhanced, segments, skipped, method, maxChars } = raw;
  if (typeof original !== "string" || typeof enhanced !== "string") return fail("text fields");
  if (method !== "rules") return fail("method");
  if (typeof maxChars !== "number" || !Number.isFinite(maxChars)) return fail("maxChars");
  if (!Array.isArray(segments) || !Array.isArray(skipped)) return fail("lists");
  return {
    original,
    enhanced,
    segments: segments.map(parseSegment),
    skipped: skipped.map(parseSkipped),
    method: "rules",
    maxChars,
  };
}
