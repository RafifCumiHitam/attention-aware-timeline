"""Learning session service."""

from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.exceptions import ForbiddenError, NotFoundError
from app.infrastructure.database.models.session import LearningSession, SessionStatus
from app.infrastructure.database.models.user import User
from app.infrastructure.database.repositories.session_repository import SessionRepository
from app.infrastructure.database.repositories.video_repository import VideoRepository
from app.presentation.api.schemas.session import SessionCreate, SessionUpdate
from app.shared.utils.pagination import Page, PaginationParams


class SessionService:
    def __init__(self, session: AsyncSession):
        self.sessions = SessionRepository(session)
        self.videos = VideoRepository(session)

    async def start(self, user: User, data: SessionCreate) -> LearningSession:
        video = await self.videos.get_by_id(data.video_id)
        if not video or not video.is_published:
            raise NotFoundError("Video", data.video_id)

        existing = await self.sessions.get_active_for_user_video(user.id, data.video_id)
        if existing:
            if existing.status == SessionStatus.PAUSED:
                existing.status = SessionStatus.IN_PROGRESS
                return await self.sessions.update(existing)
            return existing

        learning_session = LearningSession(
            user_id=user.id,
            video_id=data.video_id,
            status=SessionStatus.IN_PROGRESS,
            started_at=datetime.now(timezone.utc),
        )
        return await self.sessions.create(learning_session)

    async def get_by_id(self, session_id: UUID, user: User) -> LearningSession:
        s = await self.sessions.get_by_id(session_id)
        if not s:
            raise NotFoundError("Session", session_id)
        if s.user_id != user.id and not user.is_superuser:
            raise ForbiddenError()
        return s

    async def update(
        self, session_id: UUID, user: User, data: SessionUpdate
    ) -> LearningSession:
        s = await self.get_by_id(session_id, user)
        update_data = data.model_dump(exclude_unset=True)

        if "status" in update_data:
            new_status = update_data["status"]
            if new_status == SessionStatus.COMPLETED:
                s.ended_at = datetime.now(timezone.utc)
                s.progress_percent = 100.0
            elif new_status == SessionStatus.ABANDONED:
                s.ended_at = datetime.now(timezone.utc)

        for field, value in update_data.items():
            setattr(s, field, value)

        return await self.sessions.update(s)

    async def list_mine(
        self,
        user: User,
        params: PaginationParams,
        status: SessionStatus | None = None,
    ) -> Page[LearningSession]:
        items, total = await self.sessions.list_by_user(
            user.id, offset=params.offset, limit=params.limit, status=status
        )
        return Page.create(
            items=items, total=total, page=params.page, page_size=params.page_size
        )
