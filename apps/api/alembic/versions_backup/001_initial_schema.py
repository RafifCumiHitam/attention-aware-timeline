"""Initial schema: users, videos, learning_sessions, interaction_events

Revision ID: 001
Revises:
Create Date: 2026-08-05
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("hashed_password", sa.String(255), nullable=False),
        sa.Column("full_name", sa.String(255), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("is_superuser", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("avatar_url", sa.String(512), nullable=True),
        sa.Column("bio", sa.Text(), nullable=True),
        sa.Column("attention_tracking_enabled", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("gaze_estimation_enabled", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)

    op.create_table(
        "videos",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("video_url", sa.String(1024), nullable=False),
        sa.Column("thumbnail_url", sa.String(1024), nullable=True),
        sa.Column("duration_seconds", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("module", sa.String(128), nullable=True),
        sa.Column("order_index", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("tags", postgresql.ARRAY(sa.String()), nullable=True),
        sa.Column("is_published", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_by_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_videos_title", "videos", ["title"])
    op.create_index("ix_videos_module", "videos", ["module"])

    session_status = postgresql.ENUM(
        "in_progress", "completed", "abandoned", "paused",
        name="session_status",
        create_type=False,
    )
    session_status.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "learning_sessions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("video_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("videos.id", ondelete="CASCADE"), nullable=False),
        sa.Column("status", session_status, nullable=False, server_default="in_progress"),
        sa.Column("progress_seconds", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("progress_percent", sa.Float(), nullable=False, server_default="0"),
        sa.Column("avg_attention_score", sa.Float(), nullable=True),
        sa.Column("max_attention_score", sa.Float(), nullable=True),
        sa.Column("min_attention_score", sa.Float(), nullable=True),
        sa.Column("attention_samples", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ended_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("total_watch_seconds", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_learning_sessions_user_id", "learning_sessions", ["user_id"])
    op.create_index("ix_learning_sessions_video_id", "learning_sessions", ["video_id"])

    event_type = postgresql.ENUM(
        "play", "pause", "seek", "complete", "attention_sample", "gaze_sample",
        "focus_lost", "focus_regained", "quiz_answer", "note", "rate", "custom",
        name="event_type",
        create_type=False,
    )
    event_type.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "interaction_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("session_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("learning_sessions.id", ondelete="CASCADE"), nullable=True),
        sa.Column("video_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("videos.id", ondelete="SET NULL"), nullable=True),
        sa.Column("event_type", event_type, nullable=False),
        sa.Column("video_timestamp", sa.Float(), nullable=True),
        sa.Column("attention_score", sa.Float(), nullable=True),
        sa.Column("gaze_x", sa.Float(), nullable=True),
        sa.Column("gaze_y", sa.Float(), nullable=True),
        sa.Column("payload", postgresql.JSONB(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_interaction_events_user_id", "interaction_events", ["user_id"])
    op.create_index("ix_interaction_events_session_id", "interaction_events", ["session_id"])
    op.create_index("ix_interaction_events_video_id", "interaction_events", ["video_id"])
    op.create_index("ix_interaction_events_event_type", "interaction_events", ["event_type"])
    op.create_index("ix_interaction_events_created_at", "interaction_events", ["created_at"])


def downgrade() -> None:
    op.drop_table("interaction_events")
    op.drop_table("learning_sessions")
    op.drop_table("videos")
    op.drop_table("users")
    op.execute("DROP TYPE IF EXISTS event_type")
    op.execute("DROP TYPE IF EXISTS session_status")
