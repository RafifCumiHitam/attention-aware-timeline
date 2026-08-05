"""Difficulty timeline ORM model."""

import uuid
from datetime import datetime
from enum import Enum as PyEnum

from sqlalchemy import DateTime, Enum, Float, ForeignKey, Integer, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.database.base import Base


class TimelineOutcome(str, PyEnum):
    PENDING = "pending"
    COMPLETED = "completed"
    SKIPPED = "skipped"
    FAILED = "failed"
    IN_PROGRESS = "in_progress"


class DifficultyTimeline(Base):
    __tablename__ = "difficulty_timeline"
    __table_args__ = (
        UniqueConstraint("user_id", "sequence_index", name="uq_difficulty_timeline_user_seq"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    video_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("videos.id", ondelete="CASCADE"), nullable=False, index=True
    )
    session_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("learning_sessions.id", ondelete="SET NULL"),
        nullable=True,
    )
    sequence_index: Mapped[int] = mapped_column(Integer, nullable=False)
    difficulty_level: Mapped[float] = mapped_column(Float, nullable=False)
    reason: Mapped[str | None] = mapped_column(String(512), nullable=True)
    attention_at_decision: Mapped[float | None] = mapped_column(Float, nullable=True)
    prediction_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("ai_predictions.id", ondelete="SET NULL"),
        nullable=True,
    )
    outcome: Mapped[TimelineOutcome] = mapped_column(
        Enum(TimelineOutcome, name="timeline_outcome", values_callable=lambda x: [e.value for e in x]),
        nullable=False,
        default=TimelineOutcome.PENDING,
    )
    outcome_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    recommended_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
