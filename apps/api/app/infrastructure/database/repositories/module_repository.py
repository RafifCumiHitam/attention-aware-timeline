"""Module repository."""

from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.infrastructure.database.models.module import Module
from app.infrastructure.database.models.video import Video


class ModuleRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_by_id(self, module_id: UUID, *, with_videos: bool = False) -> Module | None:
        q = select(Module).where(Module.id == module_id)
        if with_videos:
            q = q.options(selectinload(Module.videos))
        result = await self.session.execute(q)
        return result.scalar_one_or_none()

    async def get_by_slug(self, slug: str) -> Module | None:
        result = await self.session.execute(select(Module).where(Module.slug == slug))
        return result.scalar_one_or_none()

    async def create(self, module: Module) -> Module:
        self.session.add(module)
        await self.session.flush()
        await self.session.refresh(module)
        return module

    async def update(self, module: Module) -> Module:
        self.session.add(module)
        await self.session.flush()
        await self.session.refresh(module)
        return module

    async def list_active(
        self, *, offset: int = 0, limit: int = 50, active_only: bool = True
    ) -> tuple[list[Module], int]:
        filters = []
        if active_only:
            filters.append(Module.is_active.is_(True))
        count_q = select(func.count()).select_from(Module)
        q = select(Module)
        if filters:
            count_q = count_q.where(*filters)
            q = q.where(*filters)
        total = (await self.session.execute(count_q)).scalar_one()
        result = await self.session.execute(
            q.order_by(Module.title.asc()).offset(offset).limit(limit)
        )
        return list(result.scalars().all()), total

    async def list_videos(self, module_id: UUID) -> list[Video]:
        result = await self.session.execute(
            select(Video)
            .where(Video.module_id == module_id, Video.is_active.is_(True))
            .order_by(Video.position.asc(), Video.order_index.asc())
        )
        return list(result.scalars().all())

    async def get_video_in_module(
        self, module_id: UUID, youtube_video_id: str
    ) -> Video | None:
        result = await self.session.execute(
            select(Video).where(
                Video.module_id == module_id,
                Video.youtube_video_id == youtube_video_id,
            )
        )
        return result.scalar_one_or_none()

    async def next_position(self, module_id: UUID) -> int:
        result = await self.session.execute(
            select(func.coalesce(func.max(Video.position), 0)).where(
                Video.module_id == module_id
            )
        )
        return int(result.scalar_one() or 0) + 1
