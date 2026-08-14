"""Module and YouTube DTO schemas."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class ModuleCreate(BaseModel):
    title: str = Field(min_length=2, max_length=255)
    description: str | None = None
    slug: str | None = Field(default=None, max_length=128)
    thumbnail_url: str | None = None


class ModuleUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=2, max_length=255)
    description: str | None = None
    thumbnail_url: str | None = None
    is_active: bool | None = None


class ModuleResponse(BaseModel):
    id: UUID
    title: str
    description: str | None = None
    slug: str
    thumbnail_url: str | None = None
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ModuleVideoItem(BaseModel):
    id: UUID
    module_id: UUID | None = None
    youtube_video_id: str | None = None
    title: str
    description: str | None = None
    thumbnail_url: str | None = None
    duration_seconds: int
    channel_title: str | None = None
    position: int = 0
    source_type: str = "html5"
    is_active: bool = True
    is_published: bool = False

    model_config = ConfigDict(from_attributes=True)


class ImportYouTubeVideoRequest(BaseModel):
    youtube_video_id: str = Field(min_length=6, max_length=32)


class YouTubeSearchItem(BaseModel):
    youtube_video_id: str
    title: str
    description: str = ""
    thumbnail_url: str | None = None
    channel_title: str | None = None


class YouTubeSearchResponse(BaseModel):
    items: list[YouTubeSearchItem]
    next_page_token: str | None = None
    total_results: int | None = None
