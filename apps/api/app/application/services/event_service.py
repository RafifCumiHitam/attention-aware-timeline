"""Interaction event service — rejects writes to closed sessions."""

from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.application.services.session_service import SessionService
from app.domain.exceptions import ValidationError
from app.infrastructure.database.models.event import EventType, InteractionEvent
from app.infrastructure.database.models.user import User
from app.infrastructure.database.repositories.event_repository import EventRepository
from app.presentation.api.schemas.event import EventBatchCreate, EventCreate
from app.shared.utils.pagination import Page, PaginationParams


def _parse_client_ts(value: datetime | str | None) -> datetime | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except (TypeError, ValueError):
        return None


class EventService:
    def __init__(self, session: AsyncSession):
        self.events = EventRepository(session)
        self.sessions = SessionService(session)

    async def _assert_session_writable(
        self, user: User, session_id: UUID | None
    ) -> None:
        if session_id is None:
            raise ValidationError("session_id is required for interaction events")
        await self.sessions.require_writable(session_id, user)

    async def create(self, user: User, data: EventCreate) -> InteractionEvent:
        await self._assert_session_writable(user, data.session_id)

        event = InteractionEvent(
            user_id=user.id,
            session_id=data.session_id,
            video_id=data.video_id,
            event_type=data.event_type,
            video_timestamp=data.video_timestamp,
            client_timestamp=_parse_client_ts(data.client_timestamp),
            attention_score=data.attention_score,
            gaze_x=data.gaze_x,
            gaze_y=data.gaze_y,
            payload=data.payload,
            created_at=datetime.now(timezone.utc),
        )
        return await self.events.create(event)

    async def create_batch(
        self, user: User, data: EventBatchCreate
    ) -> list[InteractionEvent]:
        # Validate every distinct session once
        session_ids = {e.session_id for e in data.events if e.session_id}
        if not session_ids:
            raise ValidationError("session_id is required for all events in the batch")
        for sid in session_ids:
            await self._assert_session_writable(user, sid)

        now = datetime.now(timezone.utc)
        events = [
            InteractionEvent(
                user_id=user.id,
                session_id=e.session_id,
                video_id=e.video_id,
                event_type=e.event_type,
                video_timestamp=e.video_timestamp,
                client_timestamp=_parse_client_ts(e.client_timestamp),
                attention_score=e.attention_score,
                gaze_x=e.gaze_x,
                gaze_y=e.gaze_y,
                payload=e.payload,
                created_at=now,
            )
            for e in data.events
        ]
        return await self.events.create_many(events)

    async def list_mine(
        self,
        user: User,
        params: PaginationParams,
        event_type: EventType | None = None,
        session_id: UUID | None = None,
    ) -> Page[InteractionEvent]:
        items, total = await self.events.list_by_user(
            user.id,
            offset=params.offset,
            limit=params.limit,
            event_type=event_type,
            session_id=session_id,
        )
        return Page.create(
            items=items, total=total, page=params.page, page_size=params.page_size
        )
