"""Analytics aggregation queries."""

from datetime import date, datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.database.models.session import LearningSession, SessionStatus
from app.infrastructure.database.models.video import Video


class AnalyticsRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def overview_stats(self, user_id: UUID) -> dict:
        result = await self.session.execute(
            select(
                func.count(LearningSession.id).label("total_sessions"),
                func.count(
                    case(
                        (LearningSession.status == SessionStatus.COMPLETED, 1),
                    )
                ).label("completed_sessions"),
                func.coalesce(func.sum(LearningSession.total_watch_seconds), 0).label(
                    "total_watch_seconds"
                ),
                func.avg(LearningSession.avg_attention_score).label("avg_attention_score"),
                func.count(func.distinct(LearningSession.video_id)).label(
                    "total_videos_watched"
                ),
            ).where(LearningSession.user_id == user_id)
        )
        row = result.one()
        return {
            "total_sessions": row.total_sessions or 0,
            "completed_sessions": row.completed_sessions or 0,
            "total_watch_seconds": int(row.total_watch_seconds or 0),
            "avg_attention_score": float(row.avg_attention_score)
            if row.avg_attention_score is not None
            else None,
            "total_videos_watched": row.total_videos_watched or 0,
        }

    async def daily_attention(
        self, user_id: UUID, days: int = 7
    ) -> list[dict]:
        since = datetime.now(timezone.utc) - timedelta(days=days)
        day_col = func.date(LearningSession.started_at)
        result = await self.session.execute(
            select(
                day_col.label("day"),
                func.avg(LearningSession.avg_attention_score).label("avg_attention"),
                func.count(LearningSession.id).label("session_count"),
                func.coalesce(func.sum(LearningSession.total_watch_seconds), 0).label(
                    "watch_seconds"
                ),
            )
            .where(
                LearningSession.user_id == user_id,
                LearningSession.started_at >= since,
            )
            .group_by(day_col)
            .order_by(day_col.asc())
        )
        return [
            {
                "date": row.day if isinstance(row.day, date) else row.day,
                "avg_attention": float(row.avg_attention) if row.avg_attention else None,
                "session_count": row.session_count,
                "watch_seconds": int(row.watch_seconds or 0),
            }
            for row in result.all()
        ]

    async def recent_sessions(self, user_id: UUID, limit: int = 10) -> list[LearningSession]:
        result = await self.session.execute(
            select(LearningSession)
            .where(LearningSession.user_id == user_id)
            .order_by(LearningSession.started_at.desc())
            .limit(limit)
        )
        return list(result.scalars().all())

    async def top_videos(self, user_id: UUID, limit: int = 5) -> list[dict]:
        result = await self.session.execute(
            select(
                LearningSession.video_id,
                Video.title,
                func.count(LearningSession.id).label("session_count"),
                func.avg(LearningSession.avg_attention_score).label("avg_attention"),
                func.coalesce(func.sum(LearningSession.total_watch_seconds), 0).label(
                    "total_watch_seconds"
                ),
            )
            .join(Video, Video.id == LearningSession.video_id)
            .where(LearningSession.user_id == user_id)
            .group_by(LearningSession.video_id, Video.title)
            .order_by(func.count(LearningSession.id).desc())
            .limit(limit)
        )
        return [
            {
                "video_id": row.video_id,
                "title": row.title,
                "session_count": row.session_count,
                "avg_attention": float(row.avg_attention) if row.avg_attention else None,
                "total_watch_seconds": int(row.total_watch_seconds or 0),
            }
            for row in result.all()
        ]
