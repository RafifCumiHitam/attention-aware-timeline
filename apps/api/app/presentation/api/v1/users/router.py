"""User endpoints."""

from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.services.user_service import UserService
from app.infrastructure.database.base import get_db
from app.infrastructure.database.models.user import User
from app.presentation.api.schemas.common import PaginatedResponse
from app.presentation.api.schemas.user import UserResponse, UserUpdate
from app.presentation.dependencies.auth import get_current_active_superuser, get_current_user
from app.presentation.dependencies.pagination import get_pagination
from app.shared.utils.pagination import PaginationParams

router = APIRouter()


@router.get("/me", response_model=UserResponse, summary="Get my profile")
async def get_my_profile(current_user: User = Depends(get_current_user)) -> User:
    return current_user


@router.patch("/me", response_model=UserResponse, summary="Update my profile")
async def update_my_profile(
    body: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> User:
    return await UserService(db).update_me(current_user, body)


@router.get(
    "/{user_id}",
    response_model=UserResponse,
    summary="Get user by ID (admin)",
)
async def get_user(
    user_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_active_superuser),
) -> User:
    return await UserService(db).get_by_id(user_id)


@router.get(
    "",
    response_model=PaginatedResponse[UserResponse],
    summary="List users (admin)",
)
async def list_users(
    params: PaginationParams = Depends(get_pagination),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_active_superuser),
) -> PaginatedResponse[UserResponse]:
    result = await UserService(db).list_users(params)
    return PaginatedResponse[UserResponse](
        items=[UserResponse.model_validate(u) for u in result.items],
        total=result.total,
        page=result.page,
        page_size=result.page_size,
        total_pages=result.total_pages,
    )
