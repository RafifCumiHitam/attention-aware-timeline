"""Pagination dependency."""

from fastapi import Query

from app.core.config import get_settings
from app.shared.utils.pagination import PaginationParams


def get_pagination(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
) -> PaginationParams:
    settings = get_settings()
    page_size = min(page_size, settings.max_page_size)
    return PaginationParams(page=page, page_size=page_size)
