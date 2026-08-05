"""Attention score schemas."""

from datetime import datetime
from enum import Enum
from typing import Any

from pydantic import BaseModel, Field


class AttentionLevel(str, Enum):
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    CRITICAL = "critical"


class AttentionRequest(BaseModel):
    """Signals used to compute attention. All optional in mock mode."""

    frame_id: str | None = None
    session_id: str | None = None
    video_timestamp: float | None = Field(default=None, ge=0)
    image_base64: str | None = None
    # Optional precomputed signals from other services
    gaze_on_screen: bool | None = None
    emotion_confidence: float | None = Field(default=None, ge=0, le=1)
    head_pose: dict[str, float] | None = None
    extra: dict[str, Any] | None = None


class AttentionResult(BaseModel):
    score: float = Field(ge=0, le=100, description="Attention score 0–100")
    level: AttentionLevel
    components: dict[str, float] = Field(default_factory=dict)
    video_timestamp: float | None = None
    frame_id: str | None = None
    session_id: str | None = None
    processed_at: datetime
    mock: bool = True
