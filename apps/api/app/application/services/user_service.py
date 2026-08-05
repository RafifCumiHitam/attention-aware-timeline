"""User service."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.exceptions import NotFoundError
from app.infrastructure.database.models.user import User
from app.infrastructure.database.repositories.user_repository import UserRepository
from app.presentation.api.schemas.user import UserUpdate
from app.shared.utils.pagination import Page, PaginationParams


class UserService:
    def __init__(self, session: AsyncSession):
        self.users = UserRepository(session)

    async def get_by_id(self, user_id: UUID) -> User:
        user = await self.users.get_by_id(user_id)
        if not user:
            raise NotFoundError("User", user_id)
        return user

    async def update_me(self, user: User, data: UserUpdate) -> User:
        update_data = data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(user, field, value)
        return await self.users.update(user)

    async def list_users(self, params: PaginationParams) -> Page[User]:
        items, total = await self.users.list_users(offset=params.offset, limit=params.limit)
        return Page.create(
            items=items, total=total, page=params.page, page_size=params.page_size
        )
