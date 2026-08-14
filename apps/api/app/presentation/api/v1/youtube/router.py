"""YouTube Data API proxy endpoints — key stays server-side."""

from fastapi import APIRouter, Depends, Query

from app.infrastructure.database.models.user import User
from app.infrastructure.external.youtube_service import YouTubeService
from app.presentation.api.schemas.module import YouTubeSearchItem, YouTubeSearchResponse
from app.presentation.dependencies.auth import get_current_user

router = APIRouter()


@router.get(
    "/search",
    response_model=YouTubeSearchResponse,
    summary="Search YouTube videos (server-side API key)",
)
async def youtube_search(
    q: str = Query(..., min_length=2, max_length=100),
    max_results: int = Query(10, ge=1, le=25),
    page_token: str | None = Query(None),
    current_user: User = Depends(get_current_user),
) -> YouTubeSearchResponse:
    data = await YouTubeService().search_videos(
        q, max_results=max_results, page_token=page_token
    )
    return YouTubeSearchResponse(
        items=[YouTubeSearchItem(**i) for i in data["items"]],
        next_page_token=data.get("next_page_token"),
        total_results=data.get("total_results"),
    )
