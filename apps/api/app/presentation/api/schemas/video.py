"""Video schemas."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class VideoBase(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    description: str | None = None
    video_url: str = Field(default="", max_length=1024)
    thumbnail_url: str | None = None
    duration_seconds: int = Field(default=0, ge=0)
    module: str | None = Field(default=None, max_length=128)
    module_id: UUID | None = None
    order_index: int = Field(default=0, ge=0)
    position: int = Field(default=0, ge=0)
    tags: list[str] | None = None
    is_published: bool = False
    source_type: str = "html5"
    youtube_video_id: str | None = None
    channel_title: str | None = None


class VideoCreate(VideoBase):
    pass


class VideoUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    video_url: str | None = None
    thumbnail_url: str | None = None
    duration_seconds: int | None = Field(default=None, ge=0)
    module: str | None = None
    module_id: UUID | None = None
    order_index: int | None = None
    position: int | None = None
    tags: list[str] | None = None
    is_published: bool | None = None


class VideoResponse(VideoBase):
    id: UUID
    created_by_id: UUID | None = None
    is_active: bool = True
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class VideoListItem(BaseModel):
    id: UUID
    title: str
    description: str | None = None
    thumbnail_url: str | None = None
    duration_seconds: int
    module: str | None = None
    module_id: UUID | None = None
    youtube_video_id: str | None = None
    source_type: str = "html5"
    order_index: int
    position: int = 0
    is_published: bool
    tags: list[str] | None = None

    model_config = ConfigDict(from_attributes=True)
