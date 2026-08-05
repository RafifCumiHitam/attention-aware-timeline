"""Analytics service."""

from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.database.models.user import User
from app.infrastructure.database.repositories.analytics_repository import AnalyticsRepository
from app.infrastructure.database.repositories.video_repository import VideoRepository
from app.presentation.api.schemas.analytics import (
    AnalyticsOverviewResponse,
    AttentionTrend,
    DailyAttentionPoint,
    OverviewStats,
    SessionAnalyticsItem,
    TopVideoItem,
)


class AnalyticsService:
    def __init__(self, session: AsyncSession):
        self.analytics = AnalyticsRepository(session)
        self.videos = VideoRepository(session)

    async def get_overview(self, user: User, trend_days: int = 7) -> AnalyticsOverviewResponse:
        stats = await self.analytics.overview_stats(user.id)
        daily = await self.analytics.daily_attention(user.id, days=trend_days)
        recent = await self.analytics.recent_sessions(user.id, limit=10)
        top = await self.analytics.top_videos(user.id, limit=5)

        # Enrich recent sessions with video titles
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
                total_sessions=stats["total_sessions"],
                completed_sessions=stats["completed_sessions"],
                total_watch_seconds=stats["total_watch_seconds"],
                avg_attention_score=stats["avg_attention_score"],
                total_videos_watched=stats["total_videos_watched"],
                active_days=len(daily),
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
