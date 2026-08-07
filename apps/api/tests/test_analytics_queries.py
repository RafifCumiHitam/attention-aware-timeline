"""Sprint 15 — analytics query unit tests (repository logic with fakes)."""

from __future__ import annotations

from datetime import datetime, timezone
from types import SimpleNamespace
from uuid import uuid4

import pytest

from app.application.services.analytics_service import AnalyticsService
from app.domain.exceptions import ForbiddenError
from app.infrastructure.database.models.session import SessionStatus


class FakeAnalyticsRepo:
    def __init__(self):
        self.user_id = None
        self.owned_sessions: set = set()

    async def overview_stats(self, user_id):
        return {
            "total_sessions": 2,
            "completed_sessions": 1,
            "total_watch_seconds": 3600,
            "avg_attention_score": 0.75,
            "total_videos_watched": 1,
        }

    async def event_counters(self, user_id, *, session_id=None, video_id=None):
        return {
            "pause_count": 5,
            "seek_count": 3,
            "forward_seek_count": 2,
            "backward_seek_count": 1,
            "avg_attention_from_events": 0.68,
            "attention_sample_count": 10,
            "avg_playback_speed": 1.1,
        }

    async def daily_attention(self, user_id, days=7):
        return [
            {
                "date": datetime.now(timezone.utc).date(),
                "avg_attention": 0.7,
                "session_count": 1,
                "watch_seconds": 600,
            }
        ]

    async def recent_sessions(self, user_id, limit=10):
        vid = uuid4()
        return [
            SimpleNamespace(
                id=uuid4(),
                video_id=vid,
                status=SessionStatus.ENDED,
                progress_percent=100.0,
                avg_attention_score=0.8,
                total_watch_seconds=600,
                started_at=datetime.now(timezone.utc),
            )
        ]

    async def top_videos(self, user_id, limit=5):
        return [
            {
                "video_id": uuid4(),
                "title": "Focus Metrics",
                "session_count": 2,
                "avg_attention": 0.75,
                "total_watch_seconds": 1200,
            }
        ]

    async def timeline_buckets(
        self, user_id, *, session_id=None, video_id=None, bucket_seconds=30.0
    ):
        return [
            {
                "start": 0.0,
                "end": 30.0,
                "pause_count": 2,
                "seek_count": 1,
                "attention_avg": 0.72,
                "event_count": 5,
            }
        ]

    async def attention_series(
        self, user_id, *, session_id=None, video_id=None, limit=500, offset=0
    ):
        return (
            [
                {
                    "video_timestamp": 124.5,
                    "attention_score": 0.38,
                    "session_id": None,
                    "client_timestamp": None,
                }
            ],
            1,
        )

    async def seek_events(
        self, user_id, *, session_id=None, video_id=None, limit=100, offset=0
    ):
        return (
            [
                {
                    "id": uuid4(),
                    "session_id": None,
                    "video_id": None,
                    "from": 120.0,
                    "to": 300.0,
                    "direction": "forward",
                    "video_timestamp": 300.0,
                    "client_timestamp": None,
                    "created_at": datetime.now(timezone.utc),
                }
            ],
            1,
        )

    async def assert_session_owned(self, user_id, session_id):
        return session_id in self.owned_sessions


class FakeVideoRepo:
    async def get_by_id(self, vid):
        return SimpleNamespace(id=vid, title="Demo Video")


@pytest.mark.asyncio
async def test_overview_includes_event_counters():
    svc = AnalyticsService.__new__(AnalyticsService)
    svc.analytics = FakeAnalyticsRepo()
    svc.videos = FakeVideoRepo()
    user = SimpleNamespace(id=uuid4(), is_superuser=False)

    result = await svc.get_overview(user)
    assert result.overview.total_sessions == 2
    assert result.overview.pause_count == 5
    assert result.overview.seek_count == 3
    assert result.overview.forward_seek_count == 2
    assert result.overview.backward_seek_count == 1
    assert result.overview.avg_playback_speed == 1.1
    assert result.overview.completion_rate == 50.0
    assert result.overview.total_watch_hours == 1.0
    # prefers event-level attention
    assert result.overview.avg_attention_score == 0.68


@pytest.mark.asyncio
async def test_timeline_bucket_shape():
    svc = AnalyticsService.__new__(AnalyticsService)
    svc.analytics = FakeAnalyticsRepo()
    svc.videos = FakeVideoRepo()
    user = SimpleNamespace(id=uuid4(), is_superuser=False)

    result = await svc.get_timeline(user, bucket_seconds=30)
    assert len(result.buckets) == 1
    b = result.buckets[0]
    assert b.start == 0.0
    assert b.end == 30.0
    assert b.pause_count == 2
    assert b.seek_count == 1
    assert b.attention_avg == 0.72


@pytest.mark.asyncio
async def test_attention_series():
    svc = AnalyticsService.__new__(AnalyticsService)
    svc.analytics = FakeAnalyticsRepo()
    svc.videos = FakeVideoRepo()
    user = SimpleNamespace(id=uuid4(), is_superuser=False)

    result = await svc.get_attention(user)
    assert result.total == 1
    assert result.points[0].video_timestamp == 124.5
    assert result.points[0].attention_score == 0.38


@pytest.mark.asyncio
async def test_seek_events_shape():
    svc = AnalyticsService.__new__(AnalyticsService)
    svc.analytics = FakeAnalyticsRepo()
    svc.videos = FakeVideoRepo()
    user = SimpleNamespace(id=uuid4(), is_superuser=False)

    result = await svc.get_events(user)
    assert result.total == 1
    item = result.items[0]
    assert item.to == 300.0
    assert item.direction == "forward"


@pytest.mark.asyncio
async def test_foreign_session_forbidden():
    svc = AnalyticsService.__new__(AnalyticsService)
    repo = FakeAnalyticsRepo()
    foreign = uuid4()
    # not in owned_sessions
    svc.analytics = repo
    svc.videos = FakeVideoRepo()
    user = SimpleNamespace(id=uuid4(), is_superuser=False)

    with pytest.raises(ForbiddenError):
        await svc.get_timeline(user, session_id=foreign)
