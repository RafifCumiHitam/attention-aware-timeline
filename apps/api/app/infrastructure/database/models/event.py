"""Interaction event ORM model — every row is session-bound for reconstruction."""

import uuid
from datetime import datetime
from enum import Enum as PyEnum

from sqlalchemy import DateTime, Enum, Float, ForeignKey, Index
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.infrastructure.database.base import Base


class EventType(str, PyEnum):
    PLAY = "play"
    PAUSE = "pause"
    SEEK = "seek"
    SEEK_FORWARD = "seek_forward"
    SEEK_BACKWARD = "seek_backward"
    SPEED_CHANGE = "speed_change"
    COMPLETE = "complete"
    ATTENTION_SAMPLE = "attention_sample"
    GAZE_SAMPLE = "gaze_sample"
    ADAPTIVE_DECISION = "adaptive_decision"
    FOCUS_LOST = "focus_lost"
    FOCUS_REGAINED = "focus_regained"
    TAB_HIDDEN = "tab_hidden"
    TAB_VISIBLE = "tab_visible"
    CAMERA_DENIED = "camera_denied"
    QUIZ_ANSWER = "quiz_answer"
    NOTE = "note"
    RATE = "rate"
    CUSTOM = "custom"


class InteractionEvent(Base):
    __tablename__ = "interaction_events"
    __table_args__ = (
        Index("ix_events_session_video_ts", "session_id", "video_timestamp"),
        Index("ix_events_video_video_ts", "video_id", "video_timestamp"),
    )

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
    # Video timeline position (seconds) — NOT wall-clock
    video_timestamp: Mapped[float | None] = mapped_column(Float, nullable=True)
    # Client wall-clock when the event was captured
    client_timestamp: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, index=True
    )
    attention_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    gaze_x: Mapped[float | None] = mapped_column(Float, nullable=True)
    gaze_y: Mapped[float | None] = mapped_column(Float, nullable=True)
    payload: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    # Server receive time
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, index=True
    )

    user: Mapped["User"] = relationship("User", back_populates="interaction_events")  # noqa: F821
    session: Mapped["LearningSession | None"] = relationship(  # noqa: F821
        "LearningSession", back_populates="events"
    )

    def __repr__(self) -> str:
        return f"<InteractionEvent {self.event_type} session={self.session_id}>"
