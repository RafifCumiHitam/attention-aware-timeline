"""Pagination helpers (internal — not for OpenAPI schemas).

API response schemas live in presentation.api.schemas.common.PaginatedResponse.
Services return Page[T] with ORM entities; routers map to Pydantic schemas.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Generic, Sequence, TypeVar

T = TypeVar("T")


@dataclass(frozen=True, slots=True)
class PaginationParams:
    page: int = 1
    page_size: int = 20

    def __post_init__(self) -> None:
        if self.page < 1:
            object.__setattr__(self, "page", 1)
        if self.page_size < 1:
            object.__setattr__(self, "page_size", 20)
        if self.page_size > 100:
            object.__setattr__(self, "page_size", 100)

    @property
    def offset(self) -> int:
        return (self.page - 1) * self.page_size

    @property
    def limit(self) -> int:
        return self.page_size


@dataclass(frozen=True, slots=True)
class Page(Generic[T]):
    """Internal paginated result container (holds ORM objects or any T)."""

    items: Sequence[T]
    total: int
    page: int
    page_size: int
    total_pages: int

    @classmethod
    def create(
        cls,
        items: Sequence[T],
        total: int,
        page: int,
        page_size: int,
    ) -> Page[T]:
        total_pages = max(1, (total + page_size - 1) // page_size) if total > 0 else 0
        return cls(
            items=items,
            total=total,
            page=page,
            page_size=page_size,
            total_pages=total_pages,
        )


# Backward-compatible alias used by older service code
PaginatedResponse = Page
