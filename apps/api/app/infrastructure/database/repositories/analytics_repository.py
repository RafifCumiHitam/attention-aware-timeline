"""Analytics aggregation queries — PostgreSQL, scoped by user_id."""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import case, cast, func, select, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.types import Float, Integer

from app.infrastructure.database.models.event import EventType, InteractionEvent
from app.infrastructure.database.models.session import LearningSession, SessionStatus
from app.infrastructure.database.models.video import Video

# Event types that count as seeks
SEEK_TYPES = (
    EventType.SEEK,
    EventType.SEEK_FORWARD,
    EventType.SEEK_BACKWARD,
)


class AnalyticsRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    # ── Session-level overview ─────────────────────────────────

    async def overview_stats(self, user_id: UUID) -> dict:
        result = await self.session.execute(
            select(
                func.count(LearningSession.id).label("total_sessions"),
                func.count(
                    case(
                        (
                            LearningSession.status.in_(
                                [SessionStatus.ENDED, SessionStatus.ABANDONED]
                            ),
                            1,
                        ),
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

    async def event_counters(
        self,
        user_id: UUID,
        *,
        session_id: UUID | None = None,
        video_id: UUID | None = None,
    ) -> dict:
        """Pause / seek / attention aggregates from interaction_events."""
        filters = [InteractionEvent.user_id == user_id]
        if session_id:
            filters.append(InteractionEvent.session_id == session_id)
        if video_id:
            filters.append(InteractionEvent.video_id == video_id)

        result = await self.session.execute(
            select(
                func.count(
                    case((InteractionEvent.event_type == EventType.PAUSE, 1))
                ).label("pause_count"),
                func.count(
                    case((InteractionEvent.event_type.in_(SEEK_TYPES), 1))
                ).label("seek_count"),
                func.count(
                    case(
                        (
                            or_(
                                InteractionEvent.event_type == EventType.SEEK_FORWARD,
                                and_(
                                    InteractionEvent.event_type == EventType.SEEK,
                                    InteractionEvent.payload["direction"].astext == "forward",
                                ),
                            ),
                            1,
                        )
                    )
                ).label("forward_seek_count"),
                func.count(
                    case(
                        (
                            or_(
                                InteractionEvent.event_type == EventType.SEEK_BACKWARD,
                                and_(
                                    InteractionEvent.event_type == EventType.SEEK,
                                    InteractionEvent.payload["direction"].astext == "backward",
                                ),
                            ),
                            1,
                        )
                    )
                ).label("backward_seek_count"),
                func.avg(
                    case(
                        (
                            InteractionEvent.event_type == EventType.ATTENTION_SAMPLE,
                            InteractionEvent.attention_score,
                        )
                    )
                ).label("avg_attention_from_events"),
                func.count(
                    case(
                        (
                            InteractionEvent.event_type == EventType.ATTENTION_SAMPLE,
                            1,
                        )
                    )
                ).label("attention_sample_count"),
            ).where(*filters)
        )
        row = result.one()

        # Average playback speed from speed_change payload.to or rate field
        speed_q = await self.session.execute(
            select(
                func.avg(
                    cast(
                        func.coalesce(
                            InteractionEvent.payload["to"].astext,
                            InteractionEvent.payload["playback_speed"].astext,
                            InteractionEvent.payload["playback_rate"].astext,
                        ),
                        Float,
                    )
                )
            ).where(
                *filters,
                InteractionEvent.event_type == EventType.SPEED_CHANGE,
            )
        )
        avg_speed = speed_q.scalar_one_or_none()

        return {
            "pause_count": int(row.pause_count or 0),
            "seek_count": int(row.seek_count or 0),
            "forward_seek_count": int(row.forward_seek_count or 0),
            "backward_seek_count": int(row.backward_seek_count or 0),
            "avg_attention_from_events": float(row.avg_attention_from_events)
            if row.avg_attention_from_events is not None
            else None,
            "attention_sample_count": int(row.attention_sample_count or 0),
            "avg_playback_speed": float(avg_speed) if avg_speed is not None else None,
        }

    async def daily_attention(self, user_id: UUID, days: int = 7) -> list[dict]:
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

    # ── Time-bucketed timeline (video_timestamp) ───────────────

    async def timeline_buckets(
        self,
        user_id: UUID,
        *,
        session_id: UUID | None = None,
        video_id: UUID | None = None,
        bucket_seconds: float = 30.0,
    ) -> list[dict]:
        """Aggregate events into [start, end) buckets on video_timestamp."""
        filters = [
            InteractionEvent.user_id == user_id,
            InteractionEvent.video_timestamp.is_not(None),
        ]
        if session_id:
            filters.append(InteractionEvent.session_id == session_id)
        if video_id:
            filters.append(InteractionEvent.video_id == video_id)

        bucket_start = (
            func.floor(InteractionEvent.video_timestamp / bucket_seconds) * bucket_seconds
        )

        result = await self.session.execute(
            select(
                bucket_start.label("start"),
                func.count(
                    case((InteractionEvent.event_type == EventType.PAUSE, 1))
                ).label("pause_count"),
                func.count(
                    case((InteractionEvent.event_type.in_(SEEK_TYPES), 1))
                ).label("seek_count"),
                func.avg(
                    case(
                        (
                            InteractionEvent.event_type == EventType.ATTENTION_SAMPLE,
                            InteractionEvent.attention_score,
                        )
                    )
                ).label("attention_avg"),
                func.count(InteractionEvent.id).label("event_count"),
            )
            .where(*filters)
            .group_by(bucket_start)
            .order_by(bucket_start.asc())
        )

        rows = []
        for row in result.all():
            start = float(row.start or 0)
            rows.append(
                {
                    "start": start,
                    "end": start + bucket_seconds,
                    "pause_count": int(row.pause_count or 0),
                    "seek_count": int(row.seek_count or 0),
                    "attention_avg": float(row.attention_avg)
                    if row.attention_avg is not None
                    else None,
                    "event_count": int(row.event_count or 0),
                }
            )
        return rows

    # ── Attention series ───────────────────────────────────────

    async def attention_series(
        self,
        user_id: UUID,
        *,
        session_id: UUID | None = None,
        video_id: UUID | None = None,
        limit: int = 500,
        offset: int = 0,
    ) -> tuple[list[dict], int]:
        filters = [
            InteractionEvent.user_id == user_id,
            InteractionEvent.event_type == EventType.ATTENTION_SAMPLE,
            InteractionEvent.attention_score.is_not(None),
            InteractionEvent.video_timestamp.is_not(None),
        ]
        if session_id:
            filters.append(InteractionEvent.session_id == session_id)
        if video_id:
            filters.append(InteractionEvent.video_id == video_id)

        count_q = await self.session.execute(
            select(func.count()).select_from(InteractionEvent).where(*filters)
        )
        total = int(count_q.scalar_one() or 0)

        result = await self.session.execute(
            select(
                InteractionEvent.video_timestamp,
                InteractionEvent.attention_score,
                InteractionEvent.session_id,
                InteractionEvent.client_timestamp,
            )
            .where(*filters)
            .order_by(InteractionEvent.video_timestamp.asc())
            .offset(offset)
            .limit(limit)
        )
        points = [
            {
                "video_timestamp": float(row.video_timestamp),
                "attention_score": float(row.attention_score),
                "session_id": row.session_id,
                "client_timestamp": row.client_timestamp,
            }
            for row in result.all()
        ]
        return points, total

    # ── Seek / interaction events ───────────────────────────────

    async def seek_events(
        self,
        user_id: UUID,
        *,
        session_id: UUID | None = None,
        video_id: UUID | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> tuple[list[dict], int]:
        filters = [
            InteractionEvent.user_id == user_id,
            InteractionEvent.event_type.in_(SEEK_TYPES),
        ]
        if session_id:
            filters.append(InteractionEvent.session_id == session_id)
        if video_id:
            filters.append(InteractionEvent.video_id == video_id)

        count_q = await self.session.execute(
            select(func.count()).select_from(InteractionEvent).where(*filters)
        )
        total = int(count_q.scalar_one() or 0)

        result = await self.session.execute(
            select(InteractionEvent)
            .where(*filters)
            .order_by(InteractionEvent.video_timestamp.asc().nulls_last())
            .offset(offset)
            .limit(limit)
        )
        items = []
        for e in result.scalars().all():
            payload = e.payload or {}
            to_ts = e.video_timestamp
            from_ts = payload.get("from")
            if from_ts is None:
                delta = payload.get("delta") or payload.get("seek_delta_seconds")
                if to_ts is not None and delta is not None:
                    try:
                        from_ts = float(to_ts) - float(delta)
                    except (TypeError, ValueError):
                        from_ts = None

            if e.event_type == EventType.SEEK_FORWARD:
                direction = "forward"
            elif e.event_type == EventType.SEEK_BACKWARD:
                direction = "backward"
            else:
                direction = payload.get("direction") or "unknown"
                if direction == "unknown" and from_ts is not None and to_ts is not None:
                    direction = "forward" if float(to_ts) >= float(from_ts) else "backward"

            items.append(
                {
                    "id": e.id,
                    "session_id": e.session_id,
                    "video_id": e.video_id,
                    "from": float(from_ts) if from_ts is not None else None,
                    "to": float(to_ts) if to_ts is not None else None,
                    "direction": direction,
                    "video_timestamp": float(to_ts) if to_ts is not None else None,
                    "client_timestamp": e.client_timestamp,
                    "created_at": e.created_at,
                }
            )
        return items, total

    async def assert_session_owned(self, user_id: UUID, session_id: UUID) -> bool:
        result = await self.session.execute(
            select(LearningSession.id).where(
                LearningSession.id == session_id,
                LearningSession.user_id == user_id,
            )
        )
        return result.scalar_one_or_none() is not None
