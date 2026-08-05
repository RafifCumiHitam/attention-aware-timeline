"""Interaction event schemas."""

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.infrastructure.database.models.event import EventType


class EventCreate(BaseModel):
    event_type: EventType
    session_id: UUID | None = None
    video_id: UUID | None = None
    video_timestamp: float | None = Field(default=None, ge=0)
    attention_score: float | None = Field(default=None, ge=0, le=100)
    gaze_x: float | None = None
    gaze_y: float | None = None
    payload: dict[str, Any] | None = None


class EventBatchCreate(BaseModel):
    events: list[EventCreate] = Field(min_length=1, max_length=100)


class EventResponse(BaseModel):
    id: UUID
    user_id: UUID
    session_id: UUID | None = None
    video_id: UUID | None = None
    event_type: EventType
    video_timestamp: float | None = None
    attention_score: float | None = None
    gaze_x: float | None = None
    gaze_y: float | None = None
    payload: dict[str, Any] | None = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
