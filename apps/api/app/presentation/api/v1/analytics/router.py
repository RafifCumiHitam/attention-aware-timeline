"""Analytics endpoints."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.services.analytics_service import AnalyticsService
from app.infrastructure.database.base import get_db
from app.infrastructure.database.models.user import User
from app.presentation.api.schemas.analytics import AnalyticsOverviewResponse
from app.presentation.dependencies.auth import get_current_user

router = APIRouter()


@router.get(
    "/overview",
    response_model=AnalyticsOverviewResponse,
    summary="Learning analytics overview",
)
async def analytics_overview(
    trend_days: int = Query(7, ge=1, le=90, description="Days of attention trend"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AnalyticsOverviewResponse:
    return await AnalyticsService(db).get_overview(current_user, trend_days=trend_days)
