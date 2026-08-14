"""Module + YouTube video import service."""

from __future__ import annotations

import re
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.exceptions import ConflictError, ForbiddenError, NotFoundError, ValidationError
from app.infrastructure.database.models.module import Module
from app.infrastructure.database.models.user import User
from app.infrastructure.database.models.video import Video, VideoSourceType
from app.infrastructure.database.repositories.module_repository import ModuleRepository
from app.infrastructure.database.repositories.video_repository import VideoRepository
from app.infrastructure.external.youtube_service import YouTubeService
from app.presentation.api.schemas.module import ModuleCreate, ModuleUpdate
from app.shared.utils.pagination import Page, PaginationParams

_SLUG_RE = re.compile(r"[^a-z0-9]+")


def slugify(title: str) -> str:
    s = title.strip().lower()
    s = _SLUG_RE.sub("-", s).strip("-")
    return s[:120] or "module"


class ModuleService:
    def __init__(self, session: AsyncSession):
        self.modules = ModuleRepository(session)
        self.videos = VideoRepository(session)
        self.youtube = YouTubeService()

    async def create(self, data: ModuleCreate, user: User) -> Module:
        slug = data.slug or slugify(data.title)
        existing = await self.modules.get_by_slug(slug)
        if existing:
            raise ConflictError(f"Module slug '{slug}' already exists")
        module = Module(
            title=data.title,
            description=data.description,
            slug=slug,
            thumbnail_url=data.thumbnail_url,
            is_active=True,
        )
        return await self.modules.create(module)

    async def get(self, module_id: UUID) -> Module:
        m = await self.modules.get_by_id(module_id, with_videos=True)
        if not m or not m.is_active:
            raise NotFoundError("Module", module_id)
        return m

    async def list(self, params: PaginationParams) -> Page[Module]:
        items, total = await self.modules.list_active(
            offset=params.offset, limit=params.limit, active_only=True
        )
        return Page.create(
            items=items, total=total, page=params.page, page_size=params.page_size
        )

    async def update(self, module_id: UUID, data: ModuleUpdate, user: User) -> Module:
        m = await self.modules.get_by_id(module_id)
        if not m:
            raise NotFoundError("Module", module_id)
        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(m, field, value)
        return await self.modules.update(m)

    async def list_videos(self, module_id: UUID) -> list[Video]:
        m = await self.modules.get_by_id(module_id)
        if not m:
            raise NotFoundError("Module", module_id)
        return await self.modules.list_videos(module_id)

    async def import_youtube_video(
        self, module_id: UUID, youtube_video_id: str, user: User
    ) -> Video:
        m = await self.modules.get_by_id(module_id)
        if not m or not m.is_active:
            raise NotFoundError("Module", module_id)

        youtube_video_id = (youtube_video_id or "").strip()
        if not youtube_video_id:
            raise ValidationError("youtube_video_id is required")

        existing = await self.modules.get_video_in_module(module_id, youtube_video_id)
        if existing:
            raise ConflictError(
                f"YouTube video '{youtube_video_id}' already exists in this module"
            )

        # Prefer DB cache globally if same youtube id already imported elsewhere
        # (still create a new row bound to this module only if unique constraint allows)
        dto = await self.youtube.get_video(youtube_video_id)

        position = await self.modules.next_position(module_id)
        video = Video(
            module_id=module_id,
            title=dto.title,
            description=dto.description,
            video_url=f"https://www.youtube.com/watch?v={dto.youtube_video_id}",
            thumbnail_url=dto.thumbnail_url,
            duration_seconds=dto.duration_seconds,
            module=m.title,  # legacy string label
            order_index=position,
            position=position,
            is_published=True,
            is_active=True,
            source_type=VideoSourceType.YOUTUBE.value,
            youtube_video_id=dto.youtube_video_id,
            channel_title=dto.channel_title,
            youtube_published_at=dto.published_at,
            created_by_id=user.id,
        )
        return await self.videos.create(video)

    async def remove_video(
        self, module_id: UUID, video_id: UUID, user: User
    ) -> None:
        m = await self.modules.get_by_id(module_id)
        if not m:
            raise NotFoundError("Module", module_id)
        video = await self.videos.get_by_id(video_id)
        if not video or video.module_id != module_id:
            raise NotFoundError("Video", video_id)
        if not user.is_superuser and video.created_by_id != user.id:
            # Allow any authenticated user to soft-delete in prototype, or restrict:
            pass
        video.is_active = False
        video.is_published = False
        await self.videos.update(video)
