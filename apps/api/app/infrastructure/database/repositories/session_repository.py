"""Learning session repository."""

from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.infrastructure.database.models.session import LearningSession, SessionStatus
from app.infrastructure.database.models.video import Video


class SessionRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_by_id(self, session_id: UUID) -> LearningSession | None:
        result = await self.session.execute(
            select(LearningSession)
            .options(selectinload(LearningSession.video))
            .where(LearningSession.id == session_id)
        )
        return result.scalar_one_or_none()

    async def create(self, learning_session: LearningSession) -> LearningSession:
        self.session.add(learning_session)
        await self.session.flush()
        await self.session.refresh(learning_session)
        return learning_session

    async def update(self, learning_session: LearningSession) -> LearningSession:
        self.session.add(learning_session)
        await self.session.flush()
        await self.session.refresh(learning_session)
        return learning_session

    async def list_by_user(
        self,
        user_id: UUID,
        *,
        offset: int = 0,
        limit: int = 20,
        status: SessionStatus | None = None,
    ) -> tuple[list[LearningSession], int]:
        query = select(LearningSession).where(LearningSession.user_id == user_id)
        count_query = (
            select(func.count())
            .select_from(LearningSession)
            .where(LearningSession.user_id == user_id)
        )
        if status:
            query = query.where(LearningSession.status == status)
            count_query = count_query.where(LearningSession.status == status)

        total = (await self.session.execute(count_query)).scalar_one()
        result = await self.session.execute(
            query.options(selectinload(LearningSession.video))
            .order_by(LearningSession.started_at.desc())
            .offset(offset)
            .limit(limit)
        )
        return list(result.scalars().all()), total

    async def get_active_for_user_video(
        self, user_id: UUID, video_id: UUID
    ) -> LearningSession | None:
        result = await self.session.execute(
            select(LearningSession).where(
                LearningSession.user_id == user_id,
                LearningSession.video_id == video_id,
                LearningSession.status.in_(
                    [SessionStatus.IN_PROGRESS, SessionStatus.PAUSED]
                ),
            )
        )
        return result.scalar_one_or_none()
