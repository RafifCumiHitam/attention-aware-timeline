"""Analytics response schemas."""

from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, Field


class OverviewStats(BaseModel):
    total_sessions: int = 0
    completed_sessions: int = 0
    total_watch_seconds: int = 0
    avg_attention_score: float | None = None
    total_videos_watched: int = 0
    active_days: int = 0


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
