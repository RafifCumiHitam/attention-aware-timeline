"""Analytics endpoints — real DB-backed aggregates."""

from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.services.analytics_service import AnalyticsService
from app.infrastructure.database.base import get_db
from app.infrastructure.database.models.user import User
from app.presentation.api.schemas.analytics import (
    AnalyticsAttentionResponse,
    AnalyticsEventsResponse,
    AnalyticsOverviewResponse,
    AnalyticsTimelineResponse,
)
from app.presentation.dependencies.auth import get_current_user

router = APIRouter()


@router.get(
    "/overview",
    response_model=AnalyticsOverviewResponse,
    summary="Learning analytics overview (sessions + events)",
)
async def analytics_overview(
    trend_days: int = Query(7, ge=1, le=90),
    session_id: UUID | None = Query(None),
    video_id: UUID | None = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AnalyticsOverviewResponse:
    return await AnalyticsService(db).get_overview(
        current_user,
        trend_days=trend_days,
        session_id=session_id,
        video_id=video_id,
    )


@router.get(
    "/timeline",
    response_model=AnalyticsTimelineResponse,
    summary="Time-bucketed event analytics by video_timestamp",
)
async def analytics_timeline(
    session_id: UUID | None = Query(None),
    video_id: UUID | None = Query(None),
    bucket_seconds: float = Query(30.0, ge=5.0, le=300.0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AnalyticsTimelineResponse:
    return await AnalyticsService(db).get_timeline(
        current_user,
        session_id=session_id,
        video_id=video_id,
        bucket_seconds=bucket_seconds,
    )


@router.get(
    "/attention",
    response_model=AnalyticsAttentionResponse,
    summary="Attention samples ordered by video_timestamp",
)
async def analytics_attention(
    session_id: UUID | None = Query(None),
    video_id: UUID | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(200, ge=1, le=1000),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AnalyticsAttentionResponse:
    return await AnalyticsService(db).get_attention(
        current_user,
        session_id=session_id,
        video_id=video_id,
        page=page,
        page_size=page_size,
    )


@router.get(
    "/events",
    response_model=AnalyticsEventsResponse,
    summary="Seek interaction events for analytics",
)
async def analytics_events(
    session_id: UUID | None = Query(None),
    video_id: UUID | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(100, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AnalyticsEventsResponse:
    return await AnalyticsService(db).get_events(
        current_user,
        session_id=session_id,
        video_id=video_id,
        page=page,
        page_size=page_size,
    )
