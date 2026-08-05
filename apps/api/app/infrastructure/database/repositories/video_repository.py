"""Video repository."""

from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.database.models.video import Video


class VideoRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_by_id(self, video_id: UUID) -> Video | None:
        result = await self.session.execute(select(Video).where(Video.id == video_id))
        return result.scalar_one_or_none()

    async def create(self, video: Video) -> Video:
        self.session.add(video)
        await self.session.flush()
        await self.session.refresh(video)
        return video

    async def update(self, video: Video) -> Video:
        self.session.add(video)
        await self.session.flush()
        await self.session.refresh(video)
        return video

    async def delete(self, video: Video) -> None:
        await self.session.delete(video)
        await self.session.flush()

    async def list_videos(
        self,
        *,
        offset: int = 0,
        limit: int = 20,
        published_only: bool = False,
        module: str | None = None,
        search: str | None = None,
    ) -> tuple[list[Video], int]:
        query = select(Video)
        count_query = select(func.count()).select_from(Video)

        if published_only:
            query = query.where(Video.is_published.is_(True))
            count_query = count_query.where(Video.is_published.is_(True))
        if module:
            query = query.where(Video.module == module)
            count_query = count_query.where(Video.module == module)
        if search:
            pattern = f"%{search}%"
            query = query.where(Video.title.ilike(pattern))
            count_query = count_query.where(Video.title.ilike(pattern))

        total = (await self.session.execute(count_query)).scalar_one()
        result = await self.session.execute(
            query.order_by(Video.order_index.asc(), Video.created_at.desc())
            .offset(offset)
            .limit(limit)
        )
        return list(result.scalars().all()), total
