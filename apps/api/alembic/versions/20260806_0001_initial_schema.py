"""initial schema for attention-aware timeline

Revision ID: 20260806_0001
Revises:
Create Date: 2026-08-06

Apply with: alembic upgrade head
"""

from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "20260806_0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"')
    op.execute('CREATE EXTENSION IF NOT EXISTS "pgcrypto"')

    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("email", sa.String(255), nullable=False, unique=True),
        sa.Column("hashed_password", sa.String(255), nullable=False),
        sa.Column("full_name", sa.String(255), nullable=True),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("is_superuser", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_users_email", "users", ["email"])

    op.create_table(
        "videos",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("title", sa.String(500), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("source_url", sa.String(2048), nullable=False),
        sa.Column("duration_seconds", sa.Float(), nullable=True),
        sa.Column("thumbnail_url", sa.String(2048), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )

    op.create_table(
        "learning_sessions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("video_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("videos.id", ondelete="CASCADE"), nullable=False),
        sa.Column("status", sa.String(32), server_default="active", nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("ended_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("progress_seconds", sa.Float(), server_default="0", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_learning_sessions_user_id", "learning_sessions", ["user_id"])
    op.create_index("ix_learning_sessions_video_id", "learning_sessions", ["video_id"])

    op.create_table(
        "interaction_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("session_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("learning_sessions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=True),
        sa.Column("event_type", sa.String(64), nullable=False),
        sa.Column("video_timestamp", sa.Float(), nullable=True),
        sa.Column("payload", postgresql.JSONB(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_interaction_events_session_id", "interaction_events", ["session_id"])
    op.create_index("ix_interaction_events_event_type", "interaction_events", ["event_type"])
    op.create_index("ix_interaction_events_created_at", "interaction_events", ["created_at"])

    op.create_table(
        "video_transcripts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("video_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("videos.id", ondelete="CASCADE"), nullable=False),
        sa.Column("language", sa.String(16), server_default="en", nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("segments", postgresql.JSONB(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )

    op.create_table(
        "ai_predictions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("session_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("learning_sessions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("prediction_type", sa.String(64), nullable=False),
        sa.Column("score", sa.Float(), nullable=True),
        sa.Column("label", sa.String(128), nullable=True),
        sa.Column("payload", postgresql.JSONB(), nullable=True),
        sa.Column("video_timestamp", sa.Float(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_ai_predictions_session_id", "ai_predictions", ["session_id"])
    op.create_index("ix_ai_predictions_type", "ai_predictions", ["prediction_type"])

    op.create_table(
        "learning_analytics",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("period_type", sa.String(32), nullable=False),
        sa.Column("period_start", sa.DateTime(timezone=True), nullable=False),
        sa.Column("metrics", postgresql.JSONB(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_learning_analytics_user_period", "learning_analytics", ["user_id", "period_type", "period_start"])

    op.create_table(
        "difficulty_timeline",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("session_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("learning_sessions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("video_timestamp", sa.Float(), nullable=False),
        sa.Column("difficulty", sa.Float(), nullable=False),
        sa.Column("outcome", sa.String(32), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )

    op.create_table(
        "summary_cache",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("resource_type", sa.String(64), nullable=False),
        sa.Column("resource_id", sa.String(255), nullable=False),
        sa.Column("content", postgresql.JSONB(), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_summary_cache_resource", "summary_cache", ["resource_type", "resource_id"], unique=True)


def downgrade() -> None:
    op.drop_table("summary_cache")
    op.drop_table("difficulty_timeline")
    op.drop_table("learning_analytics")
    op.drop_table("ai_predictions")
    op.drop_table("video_transcripts")
    op.drop_table("interaction_events")
    op.drop_table("learning_sessions")
    op.drop_table("videos")
    op.drop_table("users")
