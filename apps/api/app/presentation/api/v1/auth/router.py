"""Authentication endpoints."""

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.services.auth_service import AuthService
from app.infrastructure.database.base import get_db
from app.infrastructure.database.models.user import User
from app.presentation.api.schemas.auth import (
    AuthUserResponse,
    LoginRequest,
    RefreshRequest,
    RegisterRequest,
    TokenResponse,
)
from app.presentation.api.schemas.common import MessageResponse
from app.presentation.dependencies.auth import get_current_user

router = APIRouter()


@router.post(
    "/register",
    response_model=TokenResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new user",
)
async def register(
    body: RegisterRequest,
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    _, tokens = await AuthService(db).register(body)
    return tokens


@router.post("/login", response_model=TokenResponse, summary="Login")
async def login(
    body: LoginRequest,
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    _, tokens = await AuthService(db).login(body)
    return tokens


@router.post("/refresh", response_model=TokenResponse, summary="Refresh access token")
async def refresh(
    body: RefreshRequest,
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    return await AuthService(db).refresh(body.refresh_token)


@router.get("/me", response_model=AuthUserResponse, summary="Current user")
async def me(current_user: User = Depends(get_current_user)) -> User:
    return current_user


@router.post("/logout", response_model=MessageResponse, summary="Logout (client-side)")
async def logout(
    current_user: User = Depends(get_current_user),
) -> MessageResponse:
    # JWT is stateless; client discards tokens. Hook for token blacklist later.
    return MessageResponse(message="Logged out successfully", code="logged_out")
