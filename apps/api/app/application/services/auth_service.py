"""Authentication service."""

from uuid import UUID

from jose import JWTError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.domain.exceptions import ConflictError, UnauthorizedError
from app.infrastructure.database.models.user import User
from app.infrastructure.database.repositories.user_repository import UserRepository
from app.presentation.api.schemas.auth import LoginRequest, RegisterRequest, TokenResponse


class AuthService:
    def __init__(self, session: AsyncSession):
        self.users = UserRepository(session)

    async def register(self, data: RegisterRequest) -> tuple[User, TokenResponse]:
        existing = await self.users.get_by_email(data.email)
        if existing:
            raise ConflictError("Email already registered")

        user = User(
            email=data.email.lower(),
            hashed_password=hash_password(data.password),
            full_name=data.full_name,
        )
        user = await self.users.create(user)
        tokens = self._issue_tokens(user.id)
        return user, tokens

    async def login(self, data: LoginRequest) -> tuple[User, TokenResponse]:
        user = await self.users.get_by_email(data.email)
        if not user or not verify_password(data.password, user.hashed_password):
            raise UnauthorizedError("Invalid email or password")
        if not user.is_active:
            raise UnauthorizedError("Account is inactive")
        tokens = self._issue_tokens(user.id)
        return user, tokens

    async def refresh(self, refresh_token: str) -> TokenResponse:
        try:
            payload = decode_token(refresh_token)
            if payload.get("type") != "refresh":
                raise UnauthorizedError("Invalid refresh token")
            user_id = payload.get("sub")
            if not user_id:
                raise UnauthorizedError("Invalid refresh token")
        except JWTError as e:
            raise UnauthorizedError("Invalid or expired refresh token") from e

        user = await self.users.get_by_id(UUID(user_id))
        if not user or not user.is_active:
            raise UnauthorizedError("User not found or inactive")
        return self._issue_tokens(user.id)

    def _issue_tokens(self, user_id: UUID) -> TokenResponse:
        return TokenResponse(
            access_token=create_access_token(user_id),
            refresh_token=create_refresh_token(user_id),
        )
