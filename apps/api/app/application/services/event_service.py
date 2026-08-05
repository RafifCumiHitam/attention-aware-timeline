"""Interaction event service."""

from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.database.models.event import EventType, InteractionEvent
from app.infrastructure.database.models.user import User
from app.infrastructure.database.repositories.event_repository import EventRepository
from app.presentation.api.schemas.event import EventBatchCreate, EventCreate
from app.shared.utils.pagination import Page, PaginationParams


class EventService:
    def __init__(self, session: AsyncSession):
        self.events = EventRepository(session)

    async def create(self, user: User, data: EventCreate) -> InteractionEvent:
        event = InteractionEvent(
            user_id=user.id,
            session_id=data.session_id,
            video_id=data.video_id,
            event_type=data.event_type,
            video_timestamp=data.video_timestamp,
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
        now = datetime.now(timezone.utc)
        events = [
            InteractionEvent(
                user_id=user.id,
                session_id=e.session_id,
                video_id=e.video_id,
                event_type=e.event_type,
                video_timestamp=e.video_timestamp,
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
