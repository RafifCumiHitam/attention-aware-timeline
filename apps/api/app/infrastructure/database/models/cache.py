"""Summary cache ORM model."""

import uuid
from datetime import datetime
from enum import Enum as PyEnum

from sqlalchemy import DateTime, Enum, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.database.base import Base, TimestampMixin


class ResourceType(str, PyEnum):
    VIDEO = "video"
    SESSION = "session"
    USER = "user"
    MODULE = "module"
    TRANSCRIPT = "transcript"


class SummaryCache(Base, TimestampMixin):
    __tablename__ = "summary_cache"
    __table_args__ = (UniqueConstraint("cache_key", name="uq_summary_cache_key"),)

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    cache_key: Mapped[str] = mapped_column(String(512), nullable=False)
    resource_type: Mapped[ResourceType] = mapped_column(
        Enum(ResourceType, name="resource_type", values_callable=lambda x: [e.value for e in x]),
        nullable=False,
    )
    resource_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    summary_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    summary_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    model_used: Mapped[str | None] = mapped_column(String(128), nullable=True)
    locale: Mapped[str | None] = mapped_column(String(16), default="en")
    hit_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
