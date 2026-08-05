"""Emotion Detection endpoints."""

from fastapi import APIRouter, Depends

from app.dependencies import get_emotion_service
from app.models.emotion import EmotionRequest, EmotionResult
from app.services.emotion_service import EmotionService

router = APIRouter(prefix="/emotion", tags=["Emotion Detection"])


@router.post("/detect", response_model=EmotionResult, summary="Detect facial emotion")
async def detect_emotion(
    body: EmotionRequest,
    service: EmotionService = Depends(get_emotion_service),
) -> EmotionResult:
    """
    Detect dominant facial emotion from a video frame.

    **Mock mode:** returns deterministic scores without loading a model.
    """
    return await service.detect(body)
