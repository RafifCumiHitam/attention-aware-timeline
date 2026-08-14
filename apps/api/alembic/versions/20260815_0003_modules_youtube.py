"""Modules table + YouTube fields on videos + session.module_id

Revision ID: 20260815_0003
Revises: 20260808_0002
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "20260815_0003"
down_revision: Union[str, None] = "20260808_0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "modules",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("slug", sa.String(128), nullable=False),
        sa.Column("thumbnail_url", sa.String(1024), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_modules_title", "modules", ["title"])
    op.create_index("ix_modules_slug", "modules", ["slug"], unique=True)

    op.add_column("videos", sa.Column("module_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column("videos", sa.Column("position", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("videos", sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")))
    op.add_column("videos", sa.Column("source_type", sa.String(16), nullable=False, server_default="html5"))
    op.add_column("videos", sa.Column("youtube_video_id", sa.String(32), nullable=True))
    op.add_column("videos", sa.Column("channel_title", sa.String(255), nullable=True))
    op.add_column("videos", sa.Column("youtube_published_at", sa.DateTime(timezone=True), nullable=True))
    op.create_foreign_key("fk_videos_module_id", "videos", "modules", ["module_id"], ["id"], ondelete="SET NULL")
    op.create_index("ix_videos_module_id", "videos", ["module_id"])
    op.create_index("ix_videos_youtube_video_id", "videos", ["youtube_video_id"])
    op.create_unique_constraint("uq_video_module_youtube", "videos", ["module_id", "youtube_video_id"])

    op.add_column("learning_sessions", sa.Column("module_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.create_foreign_key(
        "fk_sessions_module_id", "learning_sessions", "modules", ["module_id"], ["id"], ondelete="SET NULL"
    )
    op.create_index("ix_learning_sessions_module_id", "learning_sessions", ["module_id"])


def downgrade() -> None:
    op.drop_index("ix_learning_sessions_module_id", table_name="learning_sessions")
    op.drop_constraint("fk_sessions_module_id", "learning_sessions", type_="foreignkey")
    op.drop_column("learning_sessions", "module_id")

    op.drop_constraint("uq_video_module_youtube", "videos", type_="unique")
    op.drop_index("ix_videos_youtube_video_id", table_name="videos")
    op.drop_index("ix_videos_module_id", table_name="videos")
    op.drop_constraint("fk_videos_module_id", "videos", type_="foreignkey")
    op.drop_column("videos", "youtube_published_at")
    op.drop_column("videos", "channel_title")
    op.drop_column("videos", "youtube_video_id")
    op.drop_column("videos", "source_type")
    op.drop_column("videos", "is_active")
    op.drop_column("videos", "position")
    op.drop_column("videos", "module_id")

    op.drop_index("ix_modules_slug", table_name="modules")
    op.drop_index("ix_modules_title", table_name="modules")
    op.drop_table("modules")
