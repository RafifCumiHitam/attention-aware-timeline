"""Emotion service — depends on EmotionDetector protocol."""

from app.emotion.interfaces import EmotionDetector
from app.models.emotion import EmotionRequest, EmotionResult


class EmotionService:
    def __init__(self, detector: EmotionDetector) -> None:
        self._detector = detector

    async def detect(self, request: EmotionRequest) -> EmotionResult:
        return await self._detector.detect(request)
