"""Learning session service — lifecycle START/ACTIVE/PAUSED/ENDED + recovery."""

from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.exceptions import ForbiddenError, NotFoundError, ValidationError
from app.infrastructure.database.models.session import LearningSession, SessionStatus
from app.infrastructure.database.models.user import User
from app.infrastructure.database.repositories.event_repository import EventRepository
from app.infrastructure.database.repositories.session_repository import SessionRepository
from app.infrastructure.database.repositories.video_repository import VideoRepository
from app.presentation.api.schemas.session import SessionCreate, SessionUpdate
from app.shared.utils.pagination import Page, PaginationParams


class SessionService:
    def __init__(self, session: AsyncSession):
        self.sessions = SessionRepository(session)
        self.videos = VideoRepository(session)
        self.events = EventRepository(session)

    async def start(self, user: User, data: SessionCreate) -> LearningSession:
        """START → ACTIVE. Resume existing ACTIVE/PAUSED for same user+video."""
        video = await self.videos.get_by_id(data.video_id)
        if not video or not video.is_published:
            raise NotFoundError("Video", data.video_id)

        existing = await self.sessions.get_active_for_user_video(user.id, data.video_id)
        if existing:
            if existing.status == SessionStatus.PAUSED:
                existing.status = SessionStatus.ACTIVE
                return await self.sessions.update(existing)
            return existing

        learning_session = LearningSession(
            user_id=user.id,
            video_id=data.video_id,
            status=SessionStatus.ACTIVE,
            started_at=datetime.now(timezone.utc),
        )
        return await self.sessions.create(learning_session)

    async def recover(
        self, user: User, session_id: UUID | None = None, video_id: UUID | None = None
    ) -> LearningSession:
        """Browser reconnect / refresh — resume PAUSED or return ACTIVE session."""
        if session_id:
            s = await self.get_by_id(session_id, user)
            if s.status in SessionStatus.closed():
                raise ValidationError(
                    f"Session {session_id} is closed ({s.status.value}); start a new session"
                )
            if s.status == SessionStatus.PAUSED:
                s.status = SessionStatus.ACTIVE
                return await self.sessions.update(s)
            return s

        if video_id:
            existing = await self.sessions.get_active_for_user_video(user.id, video_id)
            if existing:
                if existing.status == SessionStatus.PAUSED:
                    existing.status = SessionStatus.ACTIVE
                    return await self.sessions.update(existing)
                return existing
            raise NotFoundError("Session for video", video_id)

        raise ValidationError("Provide session_id or video_id to recover")

    async def pause(self, session_id: UUID, user: User) -> LearningSession:
        s = await self.get_by_id(session_id, user)
        if not s.is_writable:
            raise ValidationError(f"Cannot pause closed session ({s.status.value})")
        s.status = SessionStatus.PAUSED
        return await self.sessions.update(s)

    async def resume(self, session_id: UUID, user: User) -> LearningSession:
        s = await self.get_by_id(session_id, user)
        if s.status == SessionStatus.PAUSED:
            s.status = SessionStatus.ACTIVE
            return await self.sessions.update(s)
        if s.status == SessionStatus.ACTIVE:
            return s
        raise ValidationError(f"Cannot resume closed session ({s.status.value})")

    async def end(
        self, session_id: UUID, user: User, *, abandoned: bool = False
    ) -> LearningSession:
        s = await self.get_by_id(session_id, user)
        if s.status in SessionStatus.closed():
            return s
        s.status = SessionStatus.ABANDONED if abandoned else SessionStatus.ENDED
        s.ended_at = datetime.now(timezone.utc)
        if s.status == SessionStatus.ENDED and s.progress_percent < 100:
            pass  # keep actual progress
        return await self.sessions.update(s)

    async def get_by_id(self, session_id: UUID, user: User) -> LearningSession:
        s = await self.sessions.get_by_id(session_id)
        if not s:
            raise NotFoundError("Session", session_id)
        if s.user_id != user.id and not user.is_superuser:
            raise ForbiddenError()
        return s

    async def require_writable(self, session_id: UUID, user: User) -> LearningSession:
        s = await self.get_by_id(session_id, user)
        if not s.is_writable:
            raise ValidationError(
                f"Session {session_id} is {s.status.value}; refusing event write"
            )
        return s

    async def update(
        self, session_id: UUID, user: User, data: SessionUpdate
    ) -> LearningSession:
        s = await self.get_by_id(session_id, user)
        update_data = data.model_dump(exclude_unset=True)

        if "status" in update_data:
            new_status = update_data["status"]
            if new_status in (SessionStatus.ENDED, SessionStatus.ABANDONED, SessionStatus.COMPLETED):
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

    async def timeline(self, session_id: UUID, user: User) -> list:
        """Reconstruct ordered session events by video_timestamp then client_timestamp."""
        await self.get_by_id(session_id, user)
        events = await self.events.list_by_session_ordered(session_id)
        return events
