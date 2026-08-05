"""Video transcript ORM model."""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB, TSVECTOR, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.infrastructure.database.base import Base, TimestampMixin


class VideoTranscript(Base, TimestampMixin):
    __tablename__ = "video_transcripts"
    __table_args__ = (
        UniqueConstraint("video_id", "language", name="uq_video_transcripts_video_lang"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    video_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("videos.id", ondelete="CASCADE"), nullable=False, index=True
    )
    language: Mapped[str] = mapped_column(String(16), nullable=False, default="en")
    full_text: Mapped[str] = mapped_column(Text, nullable=False)
    segments: Mapped[dict | list] = mapped_column(JSONB, nullable=False, default=list)
    word_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    duration_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)
    source: Mapped[str | None] = mapped_column(String(64), default="manual")
    search_vector: Mapped[str | None] = mapped_column(TSVECTOR, nullable=True)

    video: Mapped["Video"] = relationship("Video", back_populates="transcripts")  # noqa: F821
