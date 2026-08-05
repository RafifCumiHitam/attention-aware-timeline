"""Emotion detection request / response schemas."""

from datetime import datetime
from enum import Enum

from pydantic import BaseModel, Field


class EmotionLabel(str, Enum):
    NEUTRAL = "neutral"
    HAPPY = "happy"
    SAD = "sad"
    SURPRISED = "surprised"
    ANGRY = "angry"
    FEARFUL = "fearful"
    DISGUSTED = "disgusted"


class EmotionScores(BaseModel):
    neutral: float = 0.0
    happy: float = 0.0
    sad: float = 0.0
    surprised: float = 0.0
    angry: float = 0.0
    fearful: float = 0.0
    disgusted: float = 0.0


class EmotionRequest(BaseModel):
    """Input for emotion detection.

    `image_base64` will be used by real models; optional in mock mode.
    """

    image_base64: str | None = Field(
        default=None,
        description="Base64-encoded image frame (RGB). Optional while mock_inference=true.",
    )
    frame_id: str | None = None
    session_id: str | None = None
    video_timestamp: float | None = Field(default=None, ge=0)


class EmotionResult(BaseModel):
    dominant: EmotionLabel
    confidence: float = Field(ge=0, le=1)
    scores: EmotionScores
    face_detected: bool = True
    frame_id: str | None = None
    session_id: str | None = None
    processed_at: datetime
    mock: bool = True
