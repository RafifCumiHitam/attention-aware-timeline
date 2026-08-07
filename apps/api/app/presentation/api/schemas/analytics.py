"""Analytics response schemas."""

from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, Field


class OverviewStats(BaseModel):
    total_sessions: int = 0
    completed_sessions: int = 0
    total_watch_seconds: int = 0
    total_watch_hours: float = 0.0
    completion_rate: float = 0.0
    avg_attention_score: float | None = None
    total_videos_watched: int = 0
    active_days: int = 0
    # Event-derived
    pause_count: int = 0
    seek_count: int = 0
    forward_seek_count: int = 0
    backward_seek_count: int = 0
    avg_playback_speed: float | None = None
    attention_sample_count: int = 0


class DailyAttentionPoint(BaseModel):
    date: date
    avg_attention: float | None = None
    session_count: int = 0
    watch_seconds: int = 0


class AttentionTrend(BaseModel):
    points: list[DailyAttentionPoint]
    period_days: int


class SessionAnalyticsItem(BaseModel):
    session_id: UUID
    video_id: UUID
    video_title: str | None = None
    status: str
    progress_percent: float
    avg_attention_score: float | None = None
    total_watch_seconds: int
    started_at: datetime


class TopVideoItem(BaseModel):
    video_id: UUID
    title: str
    session_count: int
    avg_attention: float | None = None
    total_watch_seconds: int


class AnalyticsOverviewResponse(BaseModel):
    overview: OverviewStats
    attention_trend: AttentionTrend
    recent_sessions: list[SessionAnalyticsItem]
    top_videos: list[TopVideoItem]


class TimelineBucket(BaseModel):
    start: float
    end: float
    pause_count: int = 0
    seek_count: int = 0
    attention_avg: float | None = None
    event_count: int = 0


class AnalyticsTimelineResponse(BaseModel):
    buckets: list[TimelineBucket]
    bucket_seconds: float
    session_id: UUID | None = None
    video_id: UUID | None = None


class AttentionPoint(BaseModel):
    video_timestamp: float
    attention_score: float
    session_id: UUID | None = None
    client_timestamp: datetime | None = None


class AnalyticsAttentionResponse(BaseModel):
    points: list[AttentionPoint]
    total: int
    page: int
    page_size: int


class SeekEventItem(BaseModel):
    id: UUID
    session_id: UUID | None = None
    video_id: UUID | None = None
    from_: float | None = Field(default=None, alias="from")
    to: float | None = None
    direction: str = "unknown"
    video_timestamp: float | None = None
    client_timestamp: datetime | None = None
    created_at: datetime | None = None

    model_config = {"populate_by_name": True}


class AnalyticsEventsResponse(BaseModel):
    items: list[SeekEventItem]
    total: int
    page: int
    page_size: int
