"""Analytics service — real PostgreSQL aggregates, user-scoped."""

from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.exceptions import ForbiddenError, NotFoundError
from app.infrastructure.database.models.user import User
from app.infrastructure.database.repositories.analytics_repository import AnalyticsRepository
from app.infrastructure.database.repositories.video_repository import VideoRepository
from app.presentation.api.schemas.analytics import (
    AnalyticsAttentionResponse,
    AnalyticsEventsResponse,
    AnalyticsOverviewResponse,
    AnalyticsTimelineResponse,
    AttentionPoint,
    AttentionTrend,
    DailyAttentionPoint,
    OverviewStats,
    SeekEventItem,
    SessionAnalyticsItem,
    TimelineBucket,
    TopVideoItem,
)


class AnalyticsService:
    def __init__(self, session: AsyncSession):
        self.analytics = AnalyticsRepository(session)
        self.videos = VideoRepository(session)

    async def _guard_session(self, user: User, session_id: UUID | None) -> None:
        if session_id is None:
            return
        owned = await self.analytics.assert_session_owned(user.id, session_id)
        if not owned and not user.is_superuser:
            raise ForbiddenError("Session does not belong to the current user")

    async def get_overview(
        self,
        user: User,
        trend_days: int = 7,
        session_id: UUID | None = None,
        video_id: UUID | None = None,
    ) -> AnalyticsOverviewResponse:
        await self._guard_session(user, session_id)

        stats = await self.analytics.overview_stats(user.id)
        counters = await self.analytics.event_counters(
            user.id, session_id=session_id, video_id=video_id
        )
        daily = await self.analytics.daily_attention(user.id, days=trend_days)
        recent = await self.analytics.recent_sessions(user.id, limit=10)
        top = await self.analytics.top_videos(user.id, limit=5)

        total = stats["total_sessions"] or 0
        completed = stats["completed_sessions"] or 0
        completion_rate = (completed / total * 100.0) if total else 0.0
        watch_seconds = stats["total_watch_seconds"] or 0

        # Prefer event-level attention average when samples exist
        avg_attention = counters["avg_attention_from_events"]
        if avg_attention is None:
            avg_attention = stats["avg_attention_score"]

        recent_items: list[SessionAnalyticsItem] = []
        for s in recent:
            video = await self.videos.get_by_id(s.video_id)
            recent_items.append(
                SessionAnalyticsItem(
                    session_id=s.id,
                    video_id=s.video_id,
                    video_title=video.title if video else None,
                    status=s.status.value if hasattr(s.status, "value") else str(s.status),
                    progress_percent=s.progress_percent,
                    avg_attention_score=s.avg_attention_score,
                    total_watch_seconds=s.total_watch_seconds,
                    started_at=s.started_at,
                )
            )

        return AnalyticsOverviewResponse(
            overview=OverviewStats(
                total_sessions=total,
                completed_sessions=completed,
                total_watch_seconds=watch_seconds,
                total_watch_hours=round(watch_seconds / 3600.0, 2),
                completion_rate=round(completion_rate, 1),
                avg_attention_score=avg_attention,
                total_videos_watched=stats["total_videos_watched"],
                active_days=len(daily),
                pause_count=counters["pause_count"],
                seek_count=counters["seek_count"],
                forward_seek_count=counters["forward_seek_count"],
                backward_seek_count=counters["backward_seek_count"],
                avg_playback_speed=counters["avg_playback_speed"],
                attention_sample_count=counters["attention_sample_count"],
            ),
            attention_trend=AttentionTrend(
                points=[
                    DailyAttentionPoint(
                        date=p["date"],
                        avg_attention=p["avg_attention"],
                        session_count=p["session_count"],
                        watch_seconds=p["watch_seconds"],
                    )
                    for p in daily
                ],
                period_days=trend_days,
            ),
            recent_sessions=recent_items,
            top_videos=[TopVideoItem(**t) for t in top],
        )

    async def get_timeline(
        self,
        user: User,
        *,
        session_id: UUID | None = None,
        video_id: UUID | None = None,
        bucket_seconds: float = 30.0,
    ) -> AnalyticsTimelineResponse:
        await self._guard_session(user, session_id)
        buckets = await self.analytics.timeline_buckets(
            user.id,
            session_id=session_id,
            video_id=video_id,
            bucket_seconds=bucket_seconds,
        )
        return AnalyticsTimelineResponse(
            buckets=[TimelineBucket(**b) for b in buckets],
            bucket_seconds=bucket_seconds,
            session_id=session_id,
            video_id=video_id,
        )

    async def get_attention(
        self,
        user: User,
        *,
        session_id: UUID | None = None,
        video_id: UUID | None = None,
        page: int = 1,
        page_size: int = 200,
    ) -> AnalyticsAttentionResponse:
        await self._guard_session(user, session_id)
        offset = (page - 1) * page_size
        points, total = await self.analytics.attention_series(
            user.id,
            session_id=session_id,
            video_id=video_id,
            limit=page_size,
            offset=offset,
        )
        return AnalyticsAttentionResponse(
            points=[AttentionPoint(**p) for p in points],
            total=total,
            page=page,
            page_size=page_size,
        )

    async def get_events(
        self,
        user: User,
        *,
        session_id: UUID | None = None,
        video_id: UUID | None = None,
        page: int = 1,
        page_size: int = 100,
    ) -> AnalyticsEventsResponse:
        await self._guard_session(user, session_id)
        offset = (page - 1) * page_size
        items, total = await self.analytics.seek_events(
            user.id,
            session_id=session_id,
            video_id=video_id,
            limit=page_size,
            offset=offset,
        )
        return AnalyticsEventsResponse(
            items=[
                SeekEventItem(
                    id=i["id"],
                    session_id=i["session_id"],
                    video_id=i["video_id"],
                    **{"from": i["from"]},
                    to=i["to"],
                    direction=i["direction"],
                    video_timestamp=i["video_timestamp"],
                    client_timestamp=i["client_timestamp"],
                    created_at=i["created_at"],
                )
                for i in items
            ],
            total=total,
            page=page,
            page_size=page_size,
        )
