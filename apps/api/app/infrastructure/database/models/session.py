"""Learning session ORM model — canonical session_id for all learning interactions."""

import uuid
from datetime import datetime
from enum import Enum as PyEnum

from sqlalchemy import DateTime, Enum, Float, ForeignKey, Integer, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.infrastructure.database.base import Base, TimestampMixin


class SessionStatus(str, PyEnum):
    ACTIVE = "active"
    PAUSED = "paused"
    ENDED = "ended"
    ABANDONED = "abandoned"

    IN_PROGRESS = "active"
    COMPLETED = "ended"

    @classmethod
    def writable(cls) -> set["SessionStatus"]:
        return {cls.ACTIVE, cls.PAUSED}

    @classmethod
    def closed(cls) -> set["SessionStatus"]:
        return {cls.ENDED, cls.ABANDONED}


class LearningSession(Base, TimestampMixin):
    __tablename__ = "learning_sessions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    video_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("videos.id", ondelete="CASCADE"), nullable=False, index=True
    )
    # Optional module linkage (denormalized from video.module_id for analytics)
    module_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("modules.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    status: Mapped[SessionStatus] = mapped_column(
        Enum(
            SessionStatus,
            name="session_status",
            values_callable=lambda obj: ["active", "paused", "ended", "abandoned"],
        ),
        default=SessionStatus.ACTIVE,
        nullable=False,
        index=True,
    )
    progress_seconds: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    progress_percent: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    avg_attention_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    max_attention_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    min_attention_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    attention_samples: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    total_watch_seconds: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    applied_difficulty: Mapped[float | None] = mapped_column(Float, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    user: Mapped["User"] = relationship("User", back_populates="sessions")  # noqa: F821
    video: Mapped["Video"] = relationship("Video", back_populates="sessions")  # noqa: F821
    learning_module: Mapped["Module | None"] = relationship(  # noqa: F821
        "Module", back_populates="sessions"
    )
    events: Mapped[list["InteractionEvent"]] = relationship(  # noqa: F821
        "InteractionEvent", back_populates="session", cascade="all, delete-orphan"
    )

    @property
    def is_writable(self) -> bool:
        return self.status in SessionStatus.writable()

    def __repr__(self) -> str:
        return f"<LearningSession {self.id} status={self.status}>"
