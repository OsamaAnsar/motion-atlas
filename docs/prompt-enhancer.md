# Prompt enhancer (rule-based)

The **Enhance** control and `POST /api/prompts/enhance` run a small, deterministic
set of text rules. **It is not a language model.** It does not understand the
prompt, it never rewrites the subject, and it has not been evaluated against
output quality: the presets are conventional prompt vocabulary, not a measured
improvement.

## What it does

Given a prompt and optional choices, it appends up to four short descriptors
after the user's text:

| Category     | Chosen by                      | Added when                                        |
| ------------ | ------------------------------ | ------------------------------------------------- |
| `style`      | `style` option                 | text-to-video default is `cinematic`              |
| `camera`     | `camera` option                | only if requested                                 |
| `lighting`   | `lighting` option              | only if requested                                 |
| `continuity` | image-to-video mode            | always offered in image-to-video                  |

Rules:

1. **Subject first and verbatim.** The user's text is kept as written. The only
   edit is whitespace: runs of spaces, tabs, newlines and no-break spaces
   collapse to one space and the ends are trimmed.
2. **No duplication.** If the prompt already contains a keyword for a category
   (for example `dolly`, `handheld`, `drone` for camera; `sunset`, `neon`,
   `lighting` for lighting; `cinematic`, `anime`, `35mm` for style), that
   category is skipped and reported as `already_specified`. Styles never stack.
   Matching is a whole-word, case-insensitive keyword list, so it is a heuristic:
   it can skip a category on an unrelated word (for example `noir`, or `track`
   in "running track") and it cannot see meaning.
3. **Length cap: 600 characters.** This is a conservative **heuristic**, not a
   measured limit of the Wan 2.2 text encoder, and no tokenizer is run. Segments
   that would push the result over the cap are dropped whole (`too_long`), in the
   order style, camera, lighting, continuity. The user's own text is never
   truncated; a prompt that is already at or over the cap is returned unchanged.
   Length is counted in Unicode code points.
4. **Idempotent.** Every added phrase contains a keyword its own detector
   recognises, so enhancing an enhanced prompt adds nothing.
5. **No invented facts.** Segments describe technique (lens, movement, light),
   never the subject, setting, people or objects.
6. **Image-to-video.** The look should come from the input image, so there is no
   default style in this mode (a style is added only if you pick one), and a
   `consistent with the first frame` cue is appended unless the prompt already
   says something equivalent.

Joining: segments follow the prompt after `, `; if the prompt already ends in
`. ! ? , ; :` a single space is used instead.

## Presets

| Style          | Text added                                            |
| -------------- | ----------------------------------------------------- |
| `cinematic`    | cinematic, 35mm film look, shallow depth of field     |
| `documentary`  | documentary style, natural realism                    |
| `anime`        | anime style, cel shading, vibrant colors              |
| `product-shot` | studio product shot, clean seamless backdrop          |
| `none`         | (nothing)                                             |

| Camera         | Text added                         |
| -------------- | ---------------------------------- |
| `static`       | static camera                      |
| `slow-push-in` | slow push-in                       |
| `pan`          | smooth pan                         |
| `tracking`     | tracking shot                      |
| `aerial`       | aerial drone shot                  |
| `handheld`     | handheld camera                    |
| `orbit`        | slow orbit around the subject      |

| Lighting       | Text added                         |
| -------------- | ---------------------------------- |
| `natural`      | soft natural light                 |
| `golden-hour`  | golden hour light                  |
| `studio`       | soft studio lighting               |
| `neon`         | neon-lit night lighting            |
| `dramatic`     | dramatic low-key lighting          |

## API

`POST /api/prompts/enhance`

```json
{
  "prompt": "A red fox walks through snow",
  "mode": "text-to-video",
  "style": "cinematic",
  "camera": "tracking",
  "lighting": "natural"
}
```

Only `prompt` is required. `style` omitted means the mode default (cinematic for
text-to-video, none for image-to-video); `"none"` disables it. `camera` and
`lighting` omitted or `null` mean "do not add".

```json
{
  "original": "A red fox walks through snow",
  "enhanced": "A red fox walks through snow, cinematic, 35mm film look, shallow depth of field, tracking shot, soft natural light",
  "segments": [
    { "category": "style", "preset": "cinematic", "text": "cinematic, 35mm film look, shallow depth of field" },
    { "category": "camera", "preset": "tracking", "text": "tracking shot" },
    { "category": "lighting", "preset": "natural", "text": "soft natural light" }
  ],
  "skipped": [],
  "method": "rules",
  "maxChars": 600
}
```

`skipped` lists categories that were requested but not added, each with
`already_specified` or `too_long`. `method` is always `"rules"`.

Errors use the API's usual `{ "error", "detail" }` body with status `422`: a
blank prompt, a prompt over 2000 characters (the same ceiling as
`POST /api/generations`), or an unknown preset id (FastAPI's standard validation
body for that last one).

## Recent prompts

Separate from the enhancer: the generator keeps the last 10 distinct prompts you
submitted in this browser and offers them in a **Recent prompts** dropdown under
the prompt field. They are stored in `localStorage` only (key
`motion-atlas:recent-prompts:v1`), are never sent to the API, and the feature
quietly does nothing when storage is unavailable.

## Where the code lives

- Python (authoritative for the API): `apps/api/app/services/prompt_enhancer.py`
- TypeScript port (used by the in-browser `MockProvider` in demo mode):
  `apps/web/lib/prompt/enhance.ts`
- Shared fixtures: `fixtures/prompt-enhancer.json`. Both implementations are
  tested against this one file (`apps/api/tests/test_prompt_enhancer.py` and
  `apps/web/lib/prompt/enhance.test.ts`), so they cannot drift apart silently.
  The expected values were produced by the Python implementation and reviewed by
  hand. If you change a keyword list or preset, change both ports and regenerate
  or edit the fixtures.
