"""Video / Lesson ORM model — supports HTML5 and YouTube sources."""

import uuid
from datetime import datetime
from enum import Enum as PyEnum

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.infrastructure.database.base import Base, TimestampMixin


class VideoSourceType(str, PyEnum):
    HTML5 = "html5"
    YOUTUBE = "youtube"


class Video(Base, TimestampMixin):
    __tablename__ = "videos"
    __table_args__ = (
        UniqueConstraint("module_id", "youtube_video_id", name="uq_video_module_youtube"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    # Optional FK to Module (preferred). Legacy string `module` kept for compat.
    module_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("modules.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    # For HTML5: direct media URL. For YouTube: canonical watch URL (not downloaded).
    video_url: Mapped[str] = mapped_column(String(1024), nullable=False, default="")
    thumbnail_url: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    duration_seconds: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    # Legacy free-text module label (kept so existing rows still work)
    module: Mapped[str | None] = mapped_column(String(128), nullable=True, index=True)
    order_index: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    position: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    tags: Mapped[list[str] | None] = mapped_column(ARRAY(String), nullable=True)
    is_published: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    base_difficulty: Mapped[float] = mapped_column(Float, default=0.5, nullable=False)
    created_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # YouTube integration — NEVER use as internal video_id / session_id
    source_type: Mapped[str] = mapped_column(
        String(16), default=VideoSourceType.HTML5.value, nullable=False
    )
    youtube_video_id: Mapped[str | None] = mapped_column(
        String(32), nullable=True, index=True
    )
    channel_title: Mapped[str | None] = mapped_column(String(255), nullable=True)
    youtube_published_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    learning_module: Mapped["Module | None"] = relationship(  # noqa: F821
        "Module", back_populates="videos"
    )
    sessions: Mapped[list["LearningSession"]] = relationship(  # noqa: F821
        "LearningSession", back_populates="video"
    )
    transcripts: Mapped[list["VideoTranscript"]] = relationship(  # noqa: F821
        "VideoTranscript", back_populates="video", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<Video {self.title} yt={self.youtube_video_id}>"
