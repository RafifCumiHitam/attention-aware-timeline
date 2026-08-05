"""Video service."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.exceptions import ForbiddenError, NotFoundError
from app.infrastructure.database.models.user import User
from app.infrastructure.database.models.video import Video
from app.infrastructure.database.repositories.video_repository import VideoRepository
from app.presentation.api.schemas.video import VideoCreate, VideoUpdate
from app.shared.utils.pagination import Page, PaginationParams


class VideoService:
    def __init__(self, session: AsyncSession):
        self.videos = VideoRepository(session)

    async def get_by_id(self, video_id: UUID, *, require_published: bool = False) -> Video:
        video = await self.videos.get_by_id(video_id)
        if not video:
            raise NotFoundError("Video", video_id)
        if require_published and not video.is_published:
            raise NotFoundError("Video", video_id)
        return video

    async def create(self, data: VideoCreate, creator: User) -> Video:
        video = Video(**data.model_dump(), created_by_id=creator.id)
        return await self.videos.create(video)

    async def update(self, video_id: UUID, data: VideoUpdate, current_user: User) -> Video:
        video = await self.get_by_id(video_id)
        if not current_user.is_superuser and video.created_by_id != current_user.id:
            raise ForbiddenError("You can only update your own videos")
        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(video, field, value)
        return await self.videos.update(video)

    async def delete(self, video_id: UUID, current_user: User) -> None:
        video = await self.get_by_id(video_id)
        if not current_user.is_superuser and video.created_by_id != current_user.id:
            raise ForbiddenError("You can only delete your own videos")
        await self.videos.delete(video)

    async def list_videos(
        self,
        params: PaginationParams,
        *,
        published_only: bool = True,
        module: str | None = None,
        search: str | None = None,
    ) -> Page[Video]:
        items, total = await self.videos.list_videos(
            offset=params.offset,
            limit=params.limit,
            published_only=published_only,
            module=module,
            search=search,
        )
        return Page.create(
            items=items, total=total, page=params.page, page_size=params.page_size
        )
