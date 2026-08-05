"""Learning analytics ORM model (pre-aggregated rollups)."""

import uuid
from datetime import date, datetime
from enum import Enum as PyEnum

from sqlalchemy import Date, DateTime, Enum, Float, ForeignKey, Integer, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.database.base import Base, TimestampMixin


class PeriodType(str, PyEnum):
    DAY = "day"
    WEEK = "week"
    MONTH = "month"


class LearningAnalytics(Base, TimestampMixin):
    __tablename__ = "learning_analytics"
    __table_args__ = (
        UniqueConstraint(
            "user_id", "period_date", "period_type",
            name="uq_learning_analytics_user_period",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    period_date: Mapped[date] = mapped_column(Date, nullable=False)
    period_type: Mapped[PeriodType] = mapped_column(
        Enum(PeriodType, name="period_type", values_callable=lambda x: [e.value for e in x]),
        nullable=False,
        default=PeriodType.DAY,
    )
    total_watch_seconds: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    session_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    completed_sessions: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    videos_touched: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    avg_attention_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    max_attention_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    min_attention_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    attention_sample_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    focus_lost_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    engagement_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    avg_difficulty: Mapped[float | None] = mapped_column(Float, nullable=True)
    metrics: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
