"""Rule-based prompt enhancer: service rules, shared fixtures, and the endpoint."""

from __future__ import annotations

import itertools
import json
from pathlib import Path

import pytest

from app.services import prompt_enhancer as pe

FIXTURES = Path(__file__).resolve().parents[3] / "fixtures" / "prompt-enhancer.json"
DATA = json.loads(FIXTURES.read_text(encoding="utf-8"))
MODES = ["text-to-video", "image-to-video"]
STYLES = [None, "none", *pe.STYLE_PRESETS]
CAMERAS = [None, *pe.CAMERA_MOVES]
LIGHTINGS = [None, *pe.LIGHTING_PRESETS]
WHITESPACE_MIX = chr(10) + chr(9) + " " + chr(0xA0)  # newline, tab, space, no-break space


def _kwargs(inp: dict) -> dict:
    return {
        "mode": inp.get("mode", "text-to-video"),
        "style": inp.get("style"),
        "camera": inp.get("camera"),
        "lighting": inp.get("lighting"),
    }


# -- shared fixtures (the TypeScript port is checked against the same file) --


def test_fixture_cap_matches_service() -> None:
    assert DATA["maxChars"] == pe.MAX_PROMPT_CHARS


@pytest.mark.parametrize("case", DATA["cases"], ids=[c["name"] for c in DATA["cases"]])
def test_fixture_cases(case: dict) -> None:
    r = pe.enhance_prompt(case["input"]["prompt"], **_kwargs(case["input"]))
    exp = case["expected"]
    assert r.original == exp["original"]
    assert r.enhanced == exp["enhanced"]
    assert [
        {"category": s.category, "preset": s.preset, "text": s.text} for s in r.segments
    ] == exp["segments"]
    assert [{"category": s.category, "reason": s.reason} for s in r.skipped] == exp["skipped"]


# -- properties --------------------------------------------------------------

SUBJECTS = [
    "A red fox walks through snow",
    "A lighthouse at sunset, slow pan",
    "WALL-E sweeps across the skyline.",
    "x" * 560,
]


@pytest.mark.parametrize("subject", SUBJECTS)
def test_idempotent_for_every_option_combination(subject: str) -> None:
    for mode, style, camera, lighting in itertools.product(MODES, STYLES, CAMERAS, LIGHTINGS):
        kw = {"mode": mode, "style": style, "camera": camera, "lighting": lighting}
        first = pe.enhance_prompt(subject, **kw)
        again = pe.enhance_prompt(first.enhanced, **kw)
        assert again.enhanced == first.enhanced, kw
        assert again.segments == [], kw


@pytest.mark.parametrize("subject", SUBJECTS)
def test_subject_stays_first_and_verbatim(subject: str) -> None:
    r = pe.enhance_prompt(subject, style="cinematic", camera="pan", lighting="neon")
    assert r.enhanced.startswith(pe.normalize_whitespace(subject))


def test_added_segments_appear_exactly_once() -> None:
    r = pe.enhance_prompt("A cat", style="anime", camera="orbit", lighting="studio")
    assert len(r.segments) == 3
    for seg in r.segments:
        assert r.enhanced.count(seg.text) == 1


@pytest.mark.parametrize(
    ("prompt", "category"),
    [
        ("Cinematic shot of a harbour", "style"),
        ("An anime hero", "style"),
        ("A dolly shot of a harbour", "camera"),
        ("Handheld footage of a harbour", "camera"),
        ("A harbour at sunset", "lighting"),
        ("A neon-lit harbour", "lighting"),
    ],
)
def test_existing_words_are_not_duplicated(prompt: str, category: str) -> None:
    r = pe.enhance_prompt(prompt, style="cinematic", camera="pan", lighting="studio")
    assert category not in {s.category for s in r.segments}
    assert (category, "already_specified") in {(s.category, s.reason) for s in r.skipped}


def test_word_boundaries() -> None:
    # "panda" must not count as the camera word "pan".
    r = pe.enhance_prompt("A panda eating bamboo", style="none", camera="pan")
    assert [s.category for s in r.segments] == ["camera"]


def test_whitespace_is_normalised() -> None:
    r = pe.enhance_prompt("  A   cat\n\n sits \t here  ", style="none")
    assert r.enhanced == "A cat sits here"


def test_length_cap_drops_whole_segments_never_user_text() -> None:
    near = "w" * (pe.MAX_PROMPT_CHARS - 10)
    r = pe.enhance_prompt(near, camera="pan", lighting="studio")
    assert r.enhanced == near
    assert r.segments == []
    assert {s.reason for s in r.skipped} == {"too_long"}


@pytest.mark.parametrize("n", [pe.MAX_PROMPT_CHARS - 30, pe.MAX_PROMPT_CHARS, 1999, 2000])
def test_enhanced_never_exceeds_cap_unless_user_text_already_does(n: int) -> None:
    prompt = "w" * n
    r = pe.enhance_prompt(prompt, camera="orbit", lighting="neon")
    assert r.enhanced.startswith(prompt)
    assert len(r.enhanced) <= max(n, pe.MAX_PROMPT_CHARS)


def test_image_to_video_defaults() -> None:
    # No default style (the look comes from the image); continuity cue only.
    r = pe.enhance_prompt("The dog shakes off water", mode="image-to-video")
    assert [s.category for s in r.segments] == ["continuity"]


def test_empty_prompt_raises() -> None:
    with pytest.raises(ValueError):
        pe.enhance_prompt("   \n\t ")


@pytest.mark.parametrize("kw", [{"style": "bogus"}, {"camera": "bogus"}, {"lighting": "bogus"}])
def test_unknown_presets_raise(kw: dict) -> None:
    with pytest.raises(ValueError):
        pe.enhance_prompt("A cat", **kw)


# -- endpoint ----------------------------------------------------------------


async def test_endpoint_happy_path(client) -> None:
    r = await client.post(
        "/api/prompts/enhance",
        json={"prompt": "A red fox walks through snow", "camera": "tracking", "lighting": "natural"},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["method"] == "rules"
    assert body["maxChars"] == pe.MAX_PROMPT_CHARS
    assert body["original"] == "A red fox walks through snow"
    assert body["enhanced"] == (
        "A red fox walks through snow, cinematic, 35mm film look, shallow depth of field, "
        "tracking shot, soft natural light"
    )
    assert [s["category"] for s in body["segments"]] == ["style", "camera", "lighting"]
    assert body["skipped"] == []


async def test_endpoint_is_idempotent(client) -> None:
    payload = {"prompt": "A red fox walks through snow", "camera": "pan", "lighting": "neon"}
    first = (await client.post("/api/prompts/enhance", json=payload)).json()
    second = (
        await client.post("/api/prompts/enhance", json={**payload, "prompt": first["enhanced"]})
    ).json()
    assert second["enhanced"] == first["enhanced"]
    assert second["segments"] == []


async def test_endpoint_reports_skipped(client) -> None:
    r = await client.post(
        "/api/prompts/enhance", json={"prompt": "Aerial drone shot of dunes", "camera": "pan"}
    )
    assert r.status_code == 200
    skipped = r.json()["skipped"]
    assert {"category": "camera", "reason": "already_specified"} in skipped


async def test_endpoint_image_to_video(client) -> None:
    r = await client.post(
        "/api/prompts/enhance", json={"prompt": "Leaves drift", "mode": "image-to-video"}
    )
    assert r.status_code == 200
    assert [s["category"] for s in r.json()["segments"]] == ["continuity"]


@pytest.mark.parametrize("prompt", ["", "   ", WHITESPACE_MIX])
async def test_endpoint_rejects_blank_prompt(client, prompt: str) -> None:
    r = await client.post("/api/prompts/enhance", json={"prompt": prompt})
    assert r.status_code == 422
    assert r.json()["error"] == "invalid_config"
    assert "empty" in r.json()["detail"]


async def test_endpoint_rejects_missing_prompt(client) -> None:
    r = await client.post("/api/prompts/enhance", json={})
    assert r.status_code == 422


async def test_endpoint_rejects_prompt_over_2000_chars(client) -> None:
    r = await client.post("/api/prompts/enhance", json={"prompt": "a" * 2001})
    assert r.status_code == 422
    assert "2000" in r.json()["detail"]


async def test_endpoint_accepts_2000_chars_and_leaves_it_untouched(client) -> None:
    prompt = "a" * 2000
    r = await client.post("/api/prompts/enhance", json={"prompt": prompt, "camera": "pan"})
    assert r.status_code == 200
    body = r.json()
    assert body["enhanced"] == prompt
    assert body["segments"] == []
    assert {s["reason"] for s in body["skipped"]} == {"too_long"}


async def test_endpoint_rejects_unknown_preset(client) -> None:
    r = await client.post("/api/prompts/enhance", json={"prompt": "A cat", "style": "vaporwave"})
    assert r.status_code == 422
