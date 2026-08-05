"""Session summary schemas."""

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class SummaryRequest(BaseModel):
    session_id: str | None = None
    video_id: str | None = None
    title: str | None = None
    duration_seconds: int | None = Field(default=None, ge=0)
    average_attention: float | None = Field(default=None, ge=0, le=100)
    completion_percent: float | None = Field(default=None, ge=0, le=100)
    pause_count: int | None = Field(default=None, ge=0)
    seek_count: int | None = Field(default=None, ge=0)
    dominant_emotion: str | None = None
    events: list[dict[str, Any]] | None = Field(
        default=None,
        description="Optional raw interaction events for future LLM summarization",
    )


class SummaryStats(BaseModel):
    duration_seconds: int
    average_attention: float
    completion_percent: float
    pause_count: int
    seek_count: int
    dominant_emotion: str


class SummaryHighlight(BaseModel):
    timestamp: float = Field(description="Video timestamp in seconds")
    kind: str
    message: str


class SummaryResult(BaseModel):
    title: str
    narrative: str
    stats: SummaryStats
    highlights: list[SummaryHighlight]
    recommendations: list[str]
    session_id: str | None = None
    video_id: str | None = None
    processed_at: datetime
    mock: bool = True
