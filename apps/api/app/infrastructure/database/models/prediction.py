"""AI prediction ORM model."""

import uuid
from datetime import datetime
from enum import Enum as PyEnum

from sqlalchemy import DateTime, Enum, Float, ForeignKey, Integer, String, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.infrastructure.database.base import Base


class PredictionType(str, PyEnum):
    ATTENTION = "attention"
    GAZE = "gaze"
    EMOTION = "emotion"
    ENGAGEMENT = "engagement"
    DIFFICULTY = "difficulty"
    FOCUS_STATE = "focus_state"
    COMPREHENSION = "comprehension"
    CUSTOM = "custom"


class AIPrediction(Base):
    __tablename__ = "ai_predictions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    session_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("learning_sessions.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    video_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("videos.id", ondelete="SET NULL"), nullable=True
    )
    model_name: Mapped[str] = mapped_column(String(128), nullable=False)
    model_version: Mapped[str | None] = mapped_column(String(64), nullable=True)
    prediction_type: Mapped[PredictionType] = mapped_column(
        Enum(PredictionType, name="prediction_type", values_callable=lambda x: [e.value for e in x]),
        nullable=False,
        index=True,
    )
    source_event_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("interaction_events.id", ondelete="SET NULL"),
        nullable=True,
    )
    input_metadata: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    output: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    latency_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )
