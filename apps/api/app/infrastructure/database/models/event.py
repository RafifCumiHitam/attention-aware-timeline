"""Interaction event ORM model."""

import uuid
from datetime import datetime
from enum import Enum as PyEnum

from sqlalchemy import DateTime, Enum, Float, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.infrastructure.database.base import Base


class EventType(str, PyEnum):
    PLAY = "play"
    PAUSE = "pause"
    SEEK = "seek"
    COMPLETE = "complete"
    ATTENTION_SAMPLE = "attention_sample"
    GAZE_SAMPLE = "gaze_sample"
    FOCUS_LOST = "focus_lost"
    FOCUS_REGAINED = "focus_regained"
    QUIZ_ANSWER = "quiz_answer"
    NOTE = "note"
    RATE = "rate"
    CUSTOM = "custom"


class InteractionEvent(Base):
    __tablename__ = "interaction_events"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    session_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("learning_sessions.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    video_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("videos.id", ondelete="SET NULL"), nullable=True, index=True
    )
    event_type: Mapped[EventType] = mapped_column(
        Enum(EventType, name="event_type", values_callable=lambda x: [e.value for e in x]),
        nullable=False,
        index=True,
    )
    # Video timestamp when event occurred (seconds)
    video_timestamp: Mapped[float | None] = mapped_column(Float, nullable=True)
    # Attention / gaze scores at event time
    attention_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    gaze_x: Mapped[float | None] = mapped_column(Float, nullable=True)
    gaze_y: Mapped[float | None] = mapped_column(Float, nullable=True)
    # Free-form payload
    payload: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, index=True
    )

    user: Mapped["User"] = relationship("User", back_populates="interaction_events")  # noqa: F821
    session: Mapped["LearningSession | None"] = relationship(  # noqa: F821
        "LearningSession", back_populates="events"
    )

    def __repr__(self) -> str:
        return f"<InteractionEvent {self.event_type} @ {self.created_at}>"
