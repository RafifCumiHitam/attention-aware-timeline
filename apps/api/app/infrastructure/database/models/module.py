"""Learning Module ORM — groups videos into a curriculum unit."""

import uuid

from sqlalchemy import Boolean, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.infrastructure.database.base import Base, TimestampMixin


class Module(Base, TimestampMixin):
    __tablename__ = "modules"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    slug: Mapped[str] = mapped_column(String(128), nullable=False, unique=True, index=True)
    thumbnail_url: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    videos: Mapped[list["Video"]] = relationship(  # noqa: F821
        "Video", back_populates="learning_module", cascade="all, delete-orphan"
    )
    sessions: Mapped[list["LearningSession"]] = relationship(  # noqa: F821
        "LearningSession", back_populates="learning_module"
    )

    def __repr__(self) -> str:
        return f"<Module {self.slug}>"
