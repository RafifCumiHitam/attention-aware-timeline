"""Interaction event endpoints."""

from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.services.event_service import EventService
from app.infrastructure.database.base import get_db
from app.infrastructure.database.models.event import EventType
from app.infrastructure.database.models.user import User
from app.presentation.api.schemas.common import PaginatedResponse
from app.presentation.api.schemas.event import EventBatchCreate, EventCreate, EventResponse
from app.presentation.dependencies.auth import get_current_user
from app.presentation.dependencies.pagination import get_pagination
from app.shared.utils.pagination import PaginationParams

router = APIRouter()


@router.post(
    "",
    response_model=EventResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Record a single interaction event",
)
async def create_event(
    body: EventCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> EventResponse:
    event = await EventService(db).create(current_user, body)
    return EventResponse.model_validate(event)


@router.post(
    "/batch",
    response_model=list[EventResponse],
    status_code=status.HTTP_201_CREATED,
    summary="Record multiple interaction events",
)
async def create_events_batch(
    body: EventBatchCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[EventResponse]:
    events = await EventService(db).create_batch(current_user, body)
    return [EventResponse.model_validate(e) for e in events]


@router.get(
    "",
    response_model=PaginatedResponse[EventResponse],
    summary="List my interaction events",
)
async def list_events(
    params: PaginationParams = Depends(get_pagination),
    event_type: EventType | None = Query(None),
    session_id: UUID | None = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> PaginatedResponse[EventResponse]:
    result = await EventService(db).list_mine(
        current_user, params, event_type=event_type, session_id=session_id
    )
    return PaginatedResponse[EventResponse](
        items=[EventResponse.model_validate(e) for e in result.items],
        total=result.total,
        page=result.page,
        page_size=result.page_size,
        total_pages=result.total_pages,
    )
