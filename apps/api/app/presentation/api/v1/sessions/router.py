"""Learning session endpoints."""

from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.services.session_service import SessionService
from app.infrastructure.database.base import get_db
from app.infrastructure.database.models.session import SessionStatus
from app.infrastructure.database.models.user import User
from app.presentation.api.schemas.common import PaginatedResponse
from app.presentation.api.schemas.session import SessionCreate, SessionResponse, SessionUpdate
from app.presentation.dependencies.auth import get_current_user
from app.presentation.dependencies.pagination import get_pagination
from app.shared.utils.pagination import PaginationParams

router = APIRouter()


@router.post(
    "",
    response_model=SessionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Start or resume a learning session",
)
async def start_session(
    body: SessionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SessionResponse:
    s = await SessionService(db).start(current_user, body)
    return SessionResponse.model_validate(s)


@router.get(
    "",
    response_model=PaginatedResponse[SessionResponse],
    summary="List my sessions",
)
async def list_sessions(
    params: PaginationParams = Depends(get_pagination),
    status_filter: SessionStatus | None = Query(None, alias="status"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> PaginatedResponse[SessionResponse]:
    result = await SessionService(db).list_mine(current_user, params, status=status_filter)
    return PaginatedResponse[SessionResponse](
        items=[SessionResponse.model_validate(s) for s in result.items],
        total=result.total,
        page=result.page,
        page_size=result.page_size,
        total_pages=result.total_pages,
    )


@router.get("/{session_id}", response_model=SessionResponse, summary="Get session")
async def get_session(
    session_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SessionResponse:
    s = await SessionService(db).get_by_id(session_id, current_user)
    return SessionResponse.model_validate(s)


@router.patch("/{session_id}", response_model=SessionResponse, summary="Update session")
async def update_session(
    session_id: UUID,
    body: SessionUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SessionResponse:
    s = await SessionService(db).update(session_id, current_user, body)
    return SessionResponse.model_validate(s)
