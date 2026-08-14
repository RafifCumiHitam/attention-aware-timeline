"""Learning session schemas."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.infrastructure.database.models.session import SessionStatus


class SessionCreate(BaseModel):
    video_id: UUID
    module_id: UUID | None = None


class SessionRecover(BaseModel):
    session_id: UUID | None = None
    video_id: UUID | None = None


class SessionUpdate(BaseModel):
    status: SessionStatus | None = None
    progress_seconds: int | None = Field(default=None, ge=0)
    progress_percent: float | None = Field(default=None, ge=0, le=100)
    avg_attention_score: float | None = Field(default=None, ge=0, le=100)
    max_attention_score: float | None = Field(default=None, ge=0, le=100)
    min_attention_score: float | None = Field(default=None, ge=0, le=100)
    attention_samples: int | None = Field(default=None, ge=0)
    total_watch_seconds: int | None = Field(default=None, ge=0)
    notes: str | None = None


class SessionResponse(BaseModel):
    id: UUID
    user_id: UUID
    video_id: UUID
    module_id: UUID | None = None
    status: SessionStatus
    progress_seconds: int
    progress_percent: float
    avg_attention_score: float | None = None
    max_attention_score: float | None = None
    min_attention_score: float | None = None
    attention_samples: int
    started_at: datetime
    ended_at: datetime | None = None
    total_watch_seconds: int
    notes: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class SessionTimelineItem(BaseModel):
    id: UUID
    event_type: str
    video_timestamp: float | None = None
    client_timestamp: datetime | None = None
    attention_score: float | None = None
    payload: dict | None = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
