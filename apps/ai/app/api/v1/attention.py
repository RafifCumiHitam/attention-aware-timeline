"""Attention Score endpoints."""

from fastapi import APIRouter, Depends

from app.dependencies import get_attention_service
from app.models.attention import AttentionRequest, AttentionResult
from app.services.attention_service import AttentionService

router = APIRouter(prefix="/attention", tags=["Attention Score"])


@router.post("/score", response_model=AttentionResult, summary="Compute attention score")
async def score_attention(
    body: AttentionRequest,
    service: AttentionService = Depends(get_attention_service),
) -> AttentionResult:
    """
    Fuse available signals into an attention score (0–100).

    **Mock mode:** heuristic random score biased by optional input signals.
    """
    return await service.score(body)
