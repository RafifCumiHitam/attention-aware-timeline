"""Summary Generator endpoints."""

from fastapi import APIRouter, Depends

from app.dependencies import get_summary_service
from app.models.summary import SummaryRequest, SummaryResult
from app.services.summary_service import SummaryService

router = APIRouter(prefix="/summary", tags=["Summary Generator"])


@router.post("/generate", response_model=SummaryResult, summary="Generate session summary")
async def generate_summary(
    body: SummaryRequest,
    service: SummaryService = Depends(get_summary_service),
) -> SummaryResult:
    """
    Generate a structured + narrative summary of a learning session.

    **Mock mode:** template-based text; no LLM call.
    """
    return await service.generate(body)
