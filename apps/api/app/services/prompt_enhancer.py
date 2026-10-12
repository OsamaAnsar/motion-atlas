"""Rule-based prompt enhancer.

Deterministic and dependency-free: it is NOT a language model. It appends
generic *technique* descriptors (style, camera movement, lighting, and for
image-to-video a continuity cue) to the user's prompt, and never writes
anything about the subject itself.

Rules
-----
* The user's text is kept first and verbatim, apart from whitespace being
  collapsed to single spaces and trimmed.
* A category is skipped when the prompt already contains a keyword for it
  (``already_specified``), so nothing is duplicated and styles never stack.
* Output length is capped at ``MAX_PROMPT_CHARS`` characters. The cap is a
  conservative heuristic, not a measured limit of the Wan 2.2 text encoder, and
  no tokenizer is run. The user's own text is never truncated: segments that do
  not fit are dropped whole (``too_long``) in priority order
  style > camera > lighting > continuity.
* Idempotent: every segment we add contains a keyword that the detectors
  recognise, so enhancing an enhanced prompt adds nothing.

A TypeScript port lives in ``apps/web/lib/prompt/enhance.ts`` (used by the demo
-mode MockProvider). Both are verified against ``fixtures/prompt-enhancer.json``.
Keep the keyword patterns and preset text below identical to the port.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

# Heuristic ceiling for the enhanced prompt, in Unicode code points. Chosen to be
# far below any plausible text-encoder context; not derived from a measurement.
MAX_PROMPT_CHARS = 600

# Characters treated as whitespace. Spelled out so Python and JS agree exactly.
_WS = re.compile(r"[ \t\n\r\f\v   ]+")

# re.ASCII keeps \b and \w ASCII-only, matching JavaScript's behaviour.
_FLAGS = re.IGNORECASE | re.ASCII

STYLE_RE = re.compile(
    r"\b(?:cinematic|film[- ]?look|documentary|anime|manga|cel[- ]?shad\w*"
    r"|photo[- ]?realistic|hyper[- ]?realistic|3d render\w*|cgi|pixar|claymation"
    r"|stop[- ]?motion|watercolou?r|oil paint\w*|illustrat\w+|cartoon|studio ghibli"
    r"|product shot|product shoot|35mm|16mm|film grain|noir|vintage|retro|cyberpunk"
    r"|pixel art|low[- ]?poly)\b",
    _FLAGS,
)
CAMERA_RE = re.compile(
    r"\b(?:camera|pan(?:s|ning)?|tilt(?:s|ing)?|zoom(?:s|ing)?|dolly\w*"
    r"|track(?:s|ing)?|push[- ]?in|pull[- ]?(?:in|back|out)|orbit\w*|hand[- ]?held"
    r"|steadicam|gimbal|drone|aerial|crane|close[- ]?up|wide[- ]shot|medium shot"
    r"|long shot|establishing shot|pov|first[- ]person|bird'?s[- ]eye|top[- ]down)\b",
    _FLAGS,
)
LIGHTING_RE = re.compile(
    r"\b(?:light(?:s|ing|ed)?|lit|sunlight|sunlit|moonlight\w*|sunset|sunrise"
    r"|golden[- ]hour|blue[- ]hour|backlit\w*|rim[- ]light\w*|neon|glow\w*|shadow\w*"
    r"|silhouette\w*|god[- ]rays|volumetric|lens flare|candlelit|daylight|twilight"
    r"|dusk|dawn|overcast|spotlight\w*|soft[- ]?box|low[- ]key|high[- ]key|chiaroscuro)\b",
    _FLAGS,
)
CONTINUITY_RE = re.compile(
    r"\b(?:first[- ]frame|input image|source image|reference image|starting image"
    r"|initial frame|same scene)\b",
    _FLAGS,
)

STYLE_PRESETS: dict[str, str] = {
    "cinematic": "cinematic, 35mm film look, shallow depth of field",
    "documentary": "documentary style, natural realism",
    "anime": "anime style, cel shading, vibrant colors",
    "product-shot": "studio product shot, clean seamless backdrop",
}
CAMERA_MOVES: dict[str, str] = {
    "static": "static camera",
    "slow-push-in": "slow push-in",
    "pan": "smooth pan",
    "tracking": "tracking shot",
    "aerial": "aerial drone shot",
    "handheld": "handheld camera",
    "orbit": "slow orbit around the subject",
}
LIGHTING_PRESETS: dict[str, str] = {
    "natural": "soft natural light",
    "golden-hour": "golden hour light",
    "studio": "soft studio lighting",
    "neon": "neon-lit night lighting",
    "dramatic": "dramatic low-key lighting",
}
CONTINUITY_PRESET = "first-frame"
CONTINUITY_TEXT = "consistent with the first frame"

# Explicit "no style" value accepted for ``style``.
STYLE_NONE = "none"

TEXT_TO_VIDEO = "text-to-video"
IMAGE_TO_VIDEO = "image-to-video"


@dataclass(frozen=True)
class Segment:
    category: str
    preset: str
    text: str


@dataclass(frozen=True)
class Skipped:
    category: str
    reason: str  # "already_specified" | "too_long"


@dataclass(frozen=True)
class EnhanceResult:
    original: str
    enhanced: str
    segments: list[Segment]
    skipped: list[Skipped]
    max_chars: int


def normalize_whitespace(text: str) -> str:
    return _WS.sub(" ", text).strip(" ")


def _join(base: str, segments: list[Segment]) -> str:
    if not segments:
        return base
    sep = " " if base[-1] in ".!?,;:" else ", "
    return base + sep + ", ".join(s.text for s in segments)


def enhance_prompt(
    prompt: str,
    *,
    mode: str = TEXT_TO_VIDEO,
    style: str | None = None,
    camera: str | None = None,
    lighting: str | None = None,
) -> EnhanceResult:
    """Enhance ``prompt``.

    ``style`` None means "mode default": cinematic for text-to-video, nothing for
    image-to-video (the look comes from the input image). Use ``"none"`` to
    disable. ``camera`` / ``lighting`` None means not requested. Unknown preset
    ids raise ``ValueError``.
    """
    base = normalize_whitespace(prompt)
    if not base:
        raise ValueError("prompt is empty")

    if style is None:
        style = STYLE_NONE if mode == IMAGE_TO_VIDEO else "cinematic"
    if style != STYLE_NONE and style not in STYLE_PRESETS:
        raise ValueError(f"unknown style: {style}")
    if camera is not None and camera not in CAMERA_MOVES:
        raise ValueError(f"unknown camera: {camera}")
    if lighting is not None and lighting not in LIGHTING_PRESETS:
        raise ValueError(f"unknown lighting: {lighting}")

    # (category, preset id, text, detector) in priority order.
    candidates: list[tuple[str, str, str, re.Pattern[str]]] = []
    if style != STYLE_NONE:
        candidates.append(("style", style, STYLE_PRESETS[style], STYLE_RE))
    if camera is not None:
        candidates.append(("camera", camera, CAMERA_MOVES[camera], CAMERA_RE))
    if lighting is not None:
        candidates.append(("lighting", lighting, LIGHTING_PRESETS[lighting], LIGHTING_RE))
    if mode == IMAGE_TO_VIDEO:
        candidates.append(("continuity", CONTINUITY_PRESET, CONTINUITY_TEXT, CONTINUITY_RE))

    accepted: list[Segment] = []
    skipped: list[Skipped] = []
    for category, preset, text, detector in candidates:
        if detector.search(base):
            skipped.append(Skipped(category, "already_specified"))
            continue
        trial = [*accepted, Segment(category, preset, text)]
        if len(_join(base, trial)) <= MAX_PROMPT_CHARS:
            accepted = trial
        else:
            skipped.append(Skipped(category, "too_long"))

    return EnhanceResult(
        original=base,
        enhanced=_join(base, accepted),
        segments=accepted,
        skipped=skipped,
        max_chars=MAX_PROMPT_CHARS,
    )
