"""Video endpoints."""

from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.services.video_service import VideoService
from app.infrastructure.database.base import get_db
from app.infrastructure.database.models.user import User
from app.presentation.api.schemas.common import MessageResponse, PaginatedResponse
from app.presentation.api.schemas.video import (
    VideoCreate,
    VideoListItem,
    VideoResponse,
    VideoUpdate,
)
from app.presentation.dependencies.auth import get_current_user
from app.presentation.dependencies.pagination import get_pagination
from app.shared.utils.pagination import PaginationParams

router = APIRouter()


@router.get(
    "",
    response_model=PaginatedResponse[VideoListItem],
    summary="List published videos",
)
async def list_videos(
    params: PaginationParams = Depends(get_pagination),
    module: str | None = Query(None),
    search: str | None = Query(None, max_length=100),
    include_unpublished: bool = Query(False),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> PaginatedResponse[VideoListItem]:
    published_only = not (include_unpublished and current_user.is_superuser)
    result = await VideoService(db).list_videos(
        params, published_only=published_only, module=module, search=search
    )
    return PaginatedResponse[VideoListItem](
        items=[VideoListItem.model_validate(v) for v in result.items],
        total=result.total,
        page=result.page,
        page_size=result.page_size,
        total_pages=result.total_pages,
    )


@router.post(
    "",
    response_model=VideoResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create video",
)
async def create_video(
    body: VideoCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> VideoResponse:
    video = await VideoService(db).create(body, current_user)
    return VideoResponse.model_validate(video)


@router.get("/{video_id}", response_model=VideoResponse, summary="Get video")
async def get_video(
    video_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> VideoResponse:
    require_published = not current_user.is_superuser
    video = await VideoService(db).get_by_id(video_id, require_published=require_published)
    return VideoResponse.model_validate(video)


@router.patch("/{video_id}", response_model=VideoResponse, summary="Update video")
async def update_video(
    video_id: UUID,
    body: VideoUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> VideoResponse:
    video = await VideoService(db).update(video_id, body, current_user)
    return VideoResponse.model_validate(video)


@router.delete(
    "/{video_id}",
    response_model=MessageResponse,
    summary="Delete video",
)
async def delete_video(
    video_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> MessageResponse:
    await VideoService(db).delete(video_id, current_user)
    return MessageResponse(message="Video deleted", code="deleted")
