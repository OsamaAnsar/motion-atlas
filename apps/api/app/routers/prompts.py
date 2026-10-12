from __future__ import annotations

from fastapi import APIRouter

from ..errors import ValidationError
from ..schemas import (
    EnhancedSegment,
    PromptEnhanceRequest,
    PromptEnhanceResponse,
    SegmentCategory,
    SkippedSegment,
    SkipReason,
)
from ..services import prompt_enhancer as pe

router = APIRouter(prefix="/prompts", tags=["prompts"])

# Same ceiling as `GenerationCreate.prompt`, so an enhanceable prompt is always
# submittable.
MAX_INPUT_CHARS = 2000


@router.post("/enhance", response_model=PromptEnhanceResponse)
async def enhance(payload: PromptEnhanceRequest) -> PromptEnhanceResponse:
    """Rule-based prompt enhancement (deterministic; not a language model)."""
    if not pe.normalize_whitespace(payload.prompt):
        raise ValidationError("Prompt must not be empty.")
    if len(payload.prompt) > MAX_INPUT_CHARS:
        raise ValidationError(f"Prompt is longer than {MAX_INPUT_CHARS} characters.")

    result = pe.enhance_prompt(
        payload.prompt,
        mode=payload.mode.value,
        style=payload.style.value if payload.style else None,
        camera=payload.camera.value if payload.camera else None,
        lighting=payload.lighting.value if payload.lighting else None,
    )
    return PromptEnhanceResponse(
        original=result.original,
        enhanced=result.enhanced,
        segments=[
            EnhancedSegment(category=SegmentCategory(s.category), preset=s.preset, text=s.text)
            for s in result.segments
        ],
        skipped=[
            SkippedSegment(category=SegmentCategory(s.category), reason=SkipReason(s.reason))
            for s in result.skipped
        ],
        max_chars=result.max_chars,
    )
