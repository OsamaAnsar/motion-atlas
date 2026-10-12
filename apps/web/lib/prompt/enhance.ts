/**
 * Rule-based prompt enhancer: TypeScript port of
 * `apps/api/app/services/prompt_enhancer.py`.
 *
 * Deterministic text rules, NOT a language model. It appends generic technique
 * descriptors (style, camera, lighting, and for image-to-video a continuity cue)
 * after the user's text and never writes about the subject. The in-browser
 * MockProvider uses it in demo mode; the ApiProvider calls the endpoint instead.
 *
 * The keyword patterns and preset text MUST stay identical to the Python module.
 * Both are checked against `fixtures/prompt-enhancer.json` (see `enhance.test.ts`).
 * Rules and caveats are documented in `docs/prompt-enhancer.md`.
 */

import type {
  CameraMove,
  EnhancedSegment,
  LightingPreset,
  PromptEnhanceRequest,
  PromptEnhanceResult,
  PromptStyle,
  SegmentCategory,
  SkippedSegment,
} from "@/lib/types";

/**
 * Heuristic ceiling for the enhanced prompt, in Unicode code points. Far below
 * any plausible text-encoder context; not derived from a measurement.
 */
export const MAX_PROMPT_CHARS = 600;

/** Longest prompt the API accepts (same ceiling as POST /api/generations). */
export const MAX_PROMPT_INPUT_CHARS = 2000;

// Spelled out so Python and JS agree on what counts as whitespace.
const WS = /[ \t\n\r\f\v\u00a0\u2028\u2029]+/g;

const STYLE_RE = new RegExp(
  String.raw`\b(?:cinematic|film[- ]?look|documentary|anime|manga|cel[- ]?shad\w*` +
    String.raw`|photo[- ]?realistic|hyper[- ]?realistic|3d render\w*|cgi|pixar|claymation` +
    String.raw`|stop[- ]?motion|watercolou?r|oil paint\w*|illustrat\w+|cartoon|studio ghibli` +
    String.raw`|product shot|product shoot|35mm|16mm|film grain|noir|vintage|retro|cyberpunk` +
    String.raw`|pixel art|low[- ]?poly)\b`,
  "i",
);
const CAMERA_RE = new RegExp(
  String.raw`\b(?:camera|pan(?:s|ning)?|tilt(?:s|ing)?|zoom(?:s|ing)?|dolly\w*` +
    String.raw`|track(?:s|ing)?|push[- ]?in|pull[- ]?(?:in|back|out)|orbit\w*|hand[- ]?held` +
    String.raw`|steadicam|gimbal|drone|aerial|crane|close[- ]?up|wide[- ]shot|medium shot` +
    String.raw`|long shot|establishing shot|pov|first[- ]person|bird'?s[- ]eye|top[- ]down)\b`,
  "i",
);
const LIGHTING_RE = new RegExp(
  String.raw`\b(?:light(?:s|ing|ed)?|lit|sunlight|sunlit|moonlight\w*|sunset|sunrise` +
    String.raw`|golden[- ]hour|blue[- ]hour|backlit\w*|rim[- ]light\w*|neon|glow\w*|shadow\w*` +
    String.raw`|silhouette\w*|god[- ]rays|volumetric|lens flare|candlelit|daylight|twilight` +
    String.raw`|dusk|dawn|overcast|spotlight\w*|soft[- ]?box|low[- ]key|high[- ]key|chiaroscuro)\b`,
  "i",
);
const CONTINUITY_RE = new RegExp(
  String.raw`\b(?:first[- ]frame|input image|source image|reference image|starting image` +
    String.raw`|initial frame|same scene)\b`,
  "i",
);

type Concrete<T extends string> = Exclude<T, "none">;

export const STYLE_PRESETS: Record<Concrete<PromptStyle>, string> = {
  cinematic: "cinematic, 35mm film look, shallow depth of field",
  documentary: "documentary style, natural realism",
  anime: "anime style, cel shading, vibrant colors",
  "product-shot": "studio product shot, clean seamless backdrop",
};

export const CAMERA_MOVES: Record<CameraMove, string> = {
  static: "static camera",
  "slow-push-in": "slow push-in",
  pan: "smooth pan",
  tracking: "tracking shot",
  aerial: "aerial drone shot",
  handheld: "handheld camera",
  orbit: "slow orbit around the subject",
};

export const LIGHTING_PRESETS: Record<LightingPreset, string> = {
  natural: "soft natural light",
  "golden-hour": "golden hour light",
  studio: "soft studio lighting",
  neon: "neon-lit night lighting",
  dramatic: "dramatic low-key lighting",
};

const CONTINUITY_PRESET = "first-frame";
const CONTINUITY_TEXT = "consistent with the first frame";

/** Labels for the Enhance control. Values are the API's preset ids. */
export const STYLE_OPTIONS: ReadonlyArray<{ value: PromptStyle; label: string }> = [
  { value: "cinematic", label: "Cinematic" },
  { value: "documentary", label: "Documentary" },
  { value: "anime", label: "Anime" },
  { value: "product-shot", label: "Product shot" },
  { value: "none", label: "No style" },
];

export const CAMERA_OPTIONS: ReadonlyArray<{ value: CameraMove | "none"; label: string }> = [
  { value: "none", label: "No camera move" },
  { value: "static", label: "Static" },
  { value: "slow-push-in", label: "Slow push-in" },
  { value: "pan", label: "Pan" },
  { value: "tracking", label: "Tracking" },
  { value: "aerial", label: "Aerial / drone" },
  { value: "handheld", label: "Handheld" },
  { value: "orbit", label: "Orbit" },
];

export const LIGHTING_OPTIONS: ReadonlyArray<{ value: LightingPreset | "none"; label: string }> = [
  { value: "none", label: "No lighting" },
  { value: "natural", label: "Natural" },
  { value: "golden-hour", label: "Golden hour" },
  { value: "studio", label: "Studio" },
  { value: "neon", label: "Neon night" },
  { value: "dramatic", label: "Dramatic" },
];

/** Number of Unicode code points (matches Python's `len`). */
function codePoints(text: string): number {
  return Array.from(text).length;
}

export function normalizeWhitespace(text: string): string {
  return text.replace(WS, " ").replace(/^ +| +$/g, "");
}

function join(base: string, segments: readonly EnhancedSegment[]): string {
  if (segments.length === 0) return base;
  const sep = ".!?,;:".includes(base.slice(-1)) ? " " : ", ";
  return base + sep + segments.map((s) => s.text).join(", ");
}

interface Candidate {
  category: SegmentCategory;
  preset: string;
  text: string;
  detector: RegExp;
}

/**
 * Enhance a prompt. Throws on a blank prompt. Unknown preset ids are impossible
 * by type, but are still rejected at runtime for untyped callers.
 */
export function enhancePrompt(req: PromptEnhanceRequest): PromptEnhanceResult {
  const base = normalizeWhitespace(req.prompt);
  if (!base) throw new Error("Prompt must not be empty.");

  const mode = req.mode ?? "text-to-video";
  // Omitted style: cinematic for text-to-video, none for image-to-video.
  const style: PromptStyle = req.style ?? (mode === "image-to-video" ? "none" : "cinematic");

  if (style !== "none" && !Object.hasOwn(STYLE_PRESETS, style)) {
    throw new Error(`Unknown style: ${style}`);
  }
  if (req.camera !== undefined && !Object.hasOwn(CAMERA_MOVES, req.camera)) {
    throw new Error(`Unknown camera: ${req.camera}`);
  }
  if (req.lighting !== undefined && !Object.hasOwn(LIGHTING_PRESETS, req.lighting)) {
    throw new Error(`Unknown lighting: ${req.lighting}`);
  }

  // In priority order.
  const candidates: Candidate[] = [];
  if (style !== "none") {
    candidates.push({
      category: "style",
      preset: style,
      text: STYLE_PRESETS[style],
      detector: STYLE_RE,
    });
  }
  if (req.camera !== undefined) {
    candidates.push({
      category: "camera",
      preset: req.camera,
      text: CAMERA_MOVES[req.camera],
      detector: CAMERA_RE,
    });
  }
  if (req.lighting !== undefined) {
    candidates.push({
      category: "lighting",
      preset: req.lighting,
      text: LIGHTING_PRESETS[req.lighting],
      detector: LIGHTING_RE,
    });
  }
  if (mode === "image-to-video") {
    candidates.push({
      category: "continuity",
      preset: CONTINUITY_PRESET,
      text: CONTINUITY_TEXT,
      detector: CONTINUITY_RE,
    });
  }

  let accepted: EnhancedSegment[] = [];
  const skipped: SkippedSegment[] = [];
  for (const { category, preset, text, detector } of candidates) {
    if (detector.test(base)) {
      skipped.push({ category, reason: "already_specified" });
      continue;
    }
    const trial = [...accepted, { category, preset, text }];
    if (codePoints(join(base, trial)) <= MAX_PROMPT_CHARS) {
      accepted = trial;
    } else {
      skipped.push({ category, reason: "too_long" });
    }
  }

  return {
    original: base,
    enhanced: join(base, accepted),
    segments: accepted,
    skipped,
    method: "rules",
    maxChars: MAX_PROMPT_CHARS,
  };
}
