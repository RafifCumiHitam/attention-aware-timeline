"""Emotion Detection interface — implement with real model later."""

from typing import Protocol, runtime_checkable

from app.models.emotion import EmotionRequest, EmotionResult


@runtime_checkable
class EmotionDetector(Protocol):
    """Detect facial emotion from an image frame or encoded payload."""

    async def detect(self, request: EmotionRequest) -> EmotionResult:
        """
        Analyze input and return dominant emotion + confidence scores.

        Real implementation will run MediaPipe Face Mesh / FER model.
        """
        ...
