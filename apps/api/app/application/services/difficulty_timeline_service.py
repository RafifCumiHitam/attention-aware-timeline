"""DifficultyTimelineService — Behavioral Difficulty Score from interaction_events."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.application.services.difficulty_scoring import (
    RawEvent,
    compute_difficulty_timeline,
)
from app.domain.exceptions import NotFoundError
from app.domain.value_objects.difficulty_weights import (
    DEFAULT_BUCKET_SECONDS,
    DEFAULT_DIFFICULTY_WEIGHTS,
    DifficultyWeights,
)
from app.infrastructure.database.models.user import User
from app.infrastructure.database.repositories.event_repository import EventRepository
from app.infrastructure.database.repositories.video_repository import VideoRepository
from app.presentation.api.schemas.difficulty import (
    DifficultyBucketResponse,
    DifficultyTimelineResponse,
    DifficultyWeightsSchema,
)


class DifficultyTimelineService:
    def __init__(self, session: AsyncSession):
        self.events = EventRepository(session)
        self.videos = VideoRepository(session)

    async def get_for_video(
        self,
        user: User,
        video_id: UUID,
        *,
        bucket_seconds: float = DEFAULT_BUCKET_SECONDS,
        session_id: UUID | None = None,
        scope: str = "user",
        include_empty: bool = False,
        weights: DifficultyWeights | None = None,
    ) -> DifficultyTimelineResponse:
        """
        scope:
          - user: only current user's events for this video (default, private)
          - session: single learning session
        """
        video = await self.videos.get_by_id(video_id)
        if not video:
            raise NotFoundError("Video", video_id)

        if scope == "session" and session_id:
            rows = await self.events.list_by_session_ordered(session_id, limit=5000)
            # ownership: filter to user unless superuser
            if not user.is_superuser:
                rows = [e for e in rows if e.user_id == user.id]
            # ensure video match when set
            rows = [
                e
                for e in rows
                if e.video_id is None or e.video_id == video_id
            ]
        else:
            rows = await self.events.list_for_difficulty(
                user_id=user.id,
                video_id=video_id,
                session_id=session_id,
                limit=8000,
            )

        raw = [RawEvent.from_orm(e) for e in rows]
        duration = float(video.duration_seconds) if getattr(video, "duration_seconds", None) else None

        buckets = compute_difficulty_timeline(
            raw,
            bucket_seconds=bucket_seconds,
            duration_seconds=duration,
            weights=weights or DEFAULT_DIFFICULTY_WEIGHTS,
            include_empty=include_empty,
        )

        w = (weights or DEFAULT_DIFFICULTY_WEIGHTS).normalized()
        return DifficultyTimelineResponse(
            video_id=video_id,
            session_id=session_id,
            bucket_seconds=bucket_seconds,
            label="Behavioral Difficulty Score",
            disclaimer=(
                "Heuristic behavioral baseline from pause/seek/replay/revisit patterns. "
                "Not a scientifically validated difficulty measure. No emotion or DL used."
            ),
            weights=DifficultyWeightsSchema(
                pause_density=w.pause_density,
                seek_density=w.seek_density,
                backward_seek_density=w.backward_seek_density,
                replay_density=w.replay_density,
                revisit_density=w.revisit_density,
                normalized_seek_distance=w.normalized_seek_distance,
            ),
            event_count=len(raw),
            buckets=[
                DifficultyBucketResponse(
                    video_timestamp_start=b.video_timestamp_start,
                    video_timestamp_end=b.video_timestamp_end,
                    difficulty_score=b.difficulty_score,
                    pause_density=b.pause_density,
                    seek_density=b.seek_density,
                    backward_seek_density=b.backward_seek_density,
                    replay_density=b.replay_density,
                    revisit_density=b.revisit_density,
                    normalized_seek_distance=b.normalized_seek_distance,
                )
                for b in buckets
            ],
        )
