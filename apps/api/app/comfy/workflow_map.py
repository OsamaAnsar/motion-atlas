"""Workflow templating.

We never build graphs dynamically. A known-good API-format graph is exported
from ComfyUI into `comfy/workflows/`, and only a fixed set of fields is
substituted here — located by `class_type` so exact node ids don't matter.

Wan 2.2 TI2V 5B graphs typically contain:
  CLIPTextEncode            x2   (positive / negative — positive is the one wired
                                  to the sampler's `positive` input)
  KSampler / KSamplerAdvanced     seed, steps, cfg
  EmptyHunyuanLatentVideo /
    Wan22ImageToVideoLatent       width, height, length (frame count)
  LoadImage                       image (i2v only)
  VAEDecode, SaveVideo / VHS_VideoCombine
"""

from __future__ import annotations

import copy
from typing import Any

from ..models import Generation

Graph = dict[str, dict[str, Any]]

_POSITIVE_MARKERS = ("positive", "prompt")
_SAMPLER_TYPES = {"KSampler", "KSamplerAdvanced", "SamplerCustom", "SamplerCustomAdvanced"}
_LATENT_TYPES = {
    "EmptyHunyuanLatentVideo",
    "EmptyLatentVideo",
    "Wan22ImageToVideoLatent",
    "WanImageToVideoLatent",
}
_TEXT_ENCODE_TYPES = {"CLIPTextEncode"}
_LOAD_IMAGE_TYPES = {"LoadImage"}

STAGE_BY_TYPE: dict[str, str] = {
    "CLIPTextEncode": "encoding_prompt",
    "KSampler": "sampling",
    "KSamplerAdvanced": "sampling",
    "SamplerCustom": "sampling",
    "SamplerCustomAdvanced": "sampling",
    "VAEDecode": "decoding",
    "SaveVideo": "saving",
    "VHS_VideoCombine": "saving",
    "SaveAnimatedWEBP": "saving",
    "SaveAnimatedPNG": "saving",
}


def _nodes_of_type(graph: Graph, types: set[str]) -> list[str]:
    return [nid for nid, node in graph.items() if node.get("class_type") in types]


def _find_sampler(graph: Graph) -> str | None:
    ids = _nodes_of_type(graph, _SAMPLER_TYPES)
    return ids[0] if ids else None


def _positive_negative(graph: Graph) -> tuple[str | None, str | None]:
    """Resolve which CLIPTextEncode feeds the sampler's `positive` vs `negative`."""
    sampler = _find_sampler(graph)
    encoders = _nodes_of_type(graph, _TEXT_ENCODE_TYPES)
    if sampler and sampler in graph:
        inputs = graph[sampler].get("inputs", {})
        pos = _linked_node(inputs.get("positive"))
        neg = _linked_node(inputs.get("negative"))
        if pos or neg:
            return pos, neg
    # fallback: first is positive, second negative
    return (encoders[0] if encoders else None, encoders[1] if len(encoders) > 1 else None)


def _linked_node(ref: Any) -> str | None:
    # ComfyUI links are ["<node_id>", <output_index>]
    if isinstance(ref, list) and ref and isinstance(ref[0], str):
        return ref[0]
    return None


def _set_input(graph: Graph, node_id: str | None, key: str, value: Any) -> None:
    if node_id and node_id in graph:
        graph[node_id].setdefault("inputs", {})[key] = value


def apply_common(graph: Graph, row: Generation, *, positive: str, negative: str) -> None:
    pos_id, neg_id = _positive_negative(graph)
    _set_input(graph, pos_id, "text", positive)
    _set_input(graph, neg_id, "text", negative)

    sampler = _find_sampler(graph)
    _set_input(graph, sampler, "seed", row.seed)
    _set_input(graph, sampler, "noise_seed", row.seed)
    _set_input(graph, sampler, "steps", row.steps)
    _set_input(graph, sampler, "cfg", row.guidance)

    for latent_id in _nodes_of_type(graph, _LATENT_TYPES):
        _set_input(graph, latent_id, "width", row.width)
        _set_input(graph, latent_id, "height", row.height)
        _set_input(graph, latent_id, "length", row.frames)
        _set_input(graph, latent_id, "batch_size", 1)


def build_t2v(template: Graph, row: Generation, *, positive: str, negative: str) -> Graph:
    graph = copy.deepcopy(template)
    apply_common(graph, row, positive=positive, negative=negative)
    return graph


def build_i2v(
    template: Graph, row: Generation, *, positive: str, negative: str, image_name: str
) -> Graph:
    graph = copy.deepcopy(template)
    apply_common(graph, row, positive=positive, negative=negative)
    for load_id in _nodes_of_type(graph, _LOAD_IMAGE_TYPES):
        _set_input(graph, load_id, "image", image_name)
    return graph


def stage_for_node(graph: Graph, node_id: str | None) -> str | None:
    if not node_id or node_id not in graph:
        return None
    return STAGE_BY_TYPE.get(graph[node_id].get("class_type", ""))


def find_output_file(history_entry: dict[str, Any]) -> dict[str, str] | None:
    """Return {filename, subfolder, type} for the first video-like output."""
    outputs = history_entry.get("outputs", {})
    for node_output in outputs.values():
        for key in ("videos", "gifs", "images"):
            for item in node_output.get(key, []):
                fn = item.get("filename", "")
                if fn.lower().endswith((".mp4", ".webm", ".mkv", ".mov")):
                    return {
                        "filename": fn,
                        "subfolder": item.get("subfolder", ""),
                        "type": item.get("type", "output"),
                    }
    return None
