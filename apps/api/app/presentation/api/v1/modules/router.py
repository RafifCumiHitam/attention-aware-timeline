"""Module endpoints."""

from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.services.module_service import ModuleService
from app.infrastructure.database.base import get_db
from app.infrastructure.database.models.user import User
from app.presentation.api.schemas.common import MessageResponse, PaginatedResponse
from app.presentation.api.schemas.module import (
    ImportYouTubeVideoRequest,
    ModuleCreate,
    ModuleResponse,
    ModuleUpdate,
    ModuleVideoItem,
)
from app.presentation.dependencies.auth import get_current_user
from app.presentation.dependencies.pagination import get_pagination
from app.shared.utils.pagination import PaginationParams

router = APIRouter()


@router.get("", response_model=PaginatedResponse[ModuleResponse], summary="List modules")
async def list_modules(
    params: PaginationParams = Depends(get_pagination),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> PaginatedResponse[ModuleResponse]:
    result = await ModuleService(db).list(params)
    return PaginatedResponse[ModuleResponse](
        items=[ModuleResponse.model_validate(m) for m in result.items],
        total=result.total,
        page=result.page,
        page_size=result.page_size,
        total_pages=result.total_pages,
    )


@router.post(
    "",
    response_model=ModuleResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create module",
)
async def create_module(
    body: ModuleCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ModuleResponse:
    m = await ModuleService(db).create(body, current_user)
    return ModuleResponse.model_validate(m)


@router.get("/{module_id}", response_model=ModuleResponse, summary="Get module")
async def get_module(
    module_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ModuleResponse:
    m = await ModuleService(db).get(module_id)
    return ModuleResponse.model_validate(m)


@router.patch("/{module_id}", response_model=ModuleResponse, summary="Update module")
async def update_module(
    module_id: UUID,
    body: ModuleUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ModuleResponse:
    m = await ModuleService(db).update(module_id, body, current_user)
    return ModuleResponse.model_validate(m)


@router.get(
    "/{module_id}/videos",
    response_model=list[ModuleVideoItem],
    summary="List module videos",
)
async def list_module_videos(
    module_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[ModuleVideoItem]:
    videos = await ModuleService(db).list_videos(module_id)
    return [ModuleVideoItem.model_validate(v) for v in videos]


@router.post(
    "/{module_id}/videos",
    response_model=ModuleVideoItem,
    status_code=status.HTTP_201_CREATED,
    summary="Import YouTube video into module",
)
async def import_module_video(
    module_id: UUID,
    body: ImportYouTubeVideoRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ModuleVideoItem:
    video = await ModuleService(db).import_youtube_video(
        module_id, body.youtube_video_id, current_user
    )
    return ModuleVideoItem.model_validate(video)


@router.delete(
    "/{module_id}/videos/{video_id}",
    response_model=MessageResponse,
    summary="Remove video from module (soft)",
)
async def delete_module_video(
    module_id: UUID,
    video_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> MessageResponse:
    await ModuleService(db).remove_video(module_id, video_id, current_user)
    return MessageResponse(message="Video removed from module", code="deleted")
