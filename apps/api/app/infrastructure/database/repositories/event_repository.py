"""Interaction event repository."""

from datetime import datetime
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.database.models.event import EventType, InteractionEvent


class EventRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create(self, event: InteractionEvent) -> InteractionEvent:
        self.session.add(event)
        await self.session.flush()
        await self.session.refresh(event)
        return event

    async def create_many(self, events: list[InteractionEvent]) -> list[InteractionEvent]:
        self.session.add_all(events)
        await self.session.flush()
        for e in events:
            await self.session.refresh(e)
        return events

    async def list_by_user(
        self,
        user_id: UUID,
        *,
        offset: int = 0,
        limit: int = 50,
        event_type: EventType | None = None,
        session_id: UUID | None = None,
        since: datetime | None = None,
    ) -> tuple[list[InteractionEvent], int]:
        query = select(InteractionEvent).where(InteractionEvent.user_id == user_id)
        count_query = (
            select(func.count())
            .select_from(InteractionEvent)
            .where(InteractionEvent.user_id == user_id)
        )
        if event_type:
            query = query.where(InteractionEvent.event_type == event_type)
            count_query = count_query.where(InteractionEvent.event_type == event_type)
        if session_id:
            query = query.where(InteractionEvent.session_id == session_id)
            count_query = count_query.where(InteractionEvent.session_id == session_id)
        if since:
            query = query.where(InteractionEvent.created_at >= since)
            count_query = count_query.where(InteractionEvent.created_at >= since)

        total = (await self.session.execute(count_query)).scalar_one()
        result = await self.session.execute(
            query.order_by(InteractionEvent.created_at.desc()).offset(offset).limit(limit)
        )
        return list(result.scalars().all()), total

    async def list_by_session(
        self, session_id: UUID, *, limit: int = 500
    ) -> list[InteractionEvent]:
        result = await self.session.execute(
            select(InteractionEvent)
            .where(InteractionEvent.session_id == session_id)
            .order_by(InteractionEvent.created_at.asc())
            .limit(limit)
        )
        return list(result.scalars().all())
