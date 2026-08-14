"""Expand schema: transcripts, AI predictions, analytics, difficulty timeline, summary cache

Revision ID: 002
Revises: 001
Create Date: 2026-08-05
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "002"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Extensions (safe if already present via init.sql)
    op.execute('CREATE EXTENSION IF NOT EXISTS "pg_trgm"')
    op.execute('CREATE EXTENSION IF NOT EXISTS "btree_gin"')

    # --- Alter users ---
    op.add_column(
        "users",
        sa.Column("preferred_difficulty", sa.Float(), nullable=True),
    )
    op.add_column(
        "users",
        sa.Column("timezone", sa.String(64), server_default="UTC", nullable=True),
    )
    op.add_column(
        "users",
        sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_users_email_lower", "users", [sa.text("LOWER(email)")])
    op.create_index(
        "ix_users_is_active",
        "users",
        ["is_active"],
        postgresql_where=sa.text("is_active = true"),
    )

    # --- Alter videos ---
    op.add_column(
        "videos",
        sa.Column(
            "base_difficulty",
            sa.Float(),
            server_default="0.5",
            nullable=False,
        ),
    )
    op.add_column(
        "videos",
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(
        "ix_videos_title_trgm",
        "videos",
        ["title"],
        postgresql_using="gin",
        postgresql_ops={"title": "gin_trgm_ops"},
    )
    op.create_index(
        "ix_videos_published",
        "videos",
        ["is_published", "order_index"],
        postgresql_where=sa.text("is_published = true"),
    )
    op.create_index("ix_videos_difficulty", "videos", ["base_difficulty"])
    op.create_index("ix_videos_tags", "videos", ["tags"], postgresql_using="gin")

    # --- Alter learning_sessions ---
    op.add_column(
        "learning_sessions",
        sa.Column("applied_difficulty", sa.Float(), nullable=True),
    )
    op.create_index(
        "ix_sessions_user_started",
        "learning_sessions",
        ["user_id", sa.text("started_at DESC")],
    )
    op.create_index(
        "ix_sessions_user_status",
        "learning_sessions",
        ["user_id", "status"],
    )
    op.create_index(
        "ix_sessions_status_active",
        "learning_sessions",
        ["user_id", "video_id"],
        postgresql_where=sa.text("status IN ('in_progress', 'paused')"),
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_sessions_started_brin "
        "ON learning_sessions USING BRIN (started_at)"
    )

    # --- Enhance interaction_events indexes ---
    op.create_index(
        "ix_events_user_created",
        "interaction_events",
        ["user_id", sa.text("created_at DESC")],
    )
    op.create_index(
        "ix_events_user_type_created",
        "interaction_events",
        ["user_id", "event_type", sa.text("created_at DESC")],
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_events_created_brin "
        "ON interaction_events USING BRIN (created_at) WITH (pages_per_range = 32)"
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS ix_events_attention_samples
        ON interaction_events (user_id, created_at DESC, attention_score)
        WHERE event_type = 'attention_sample' AND attention_score IS NOT NULL
        """
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS ix_events_payload_gin
        ON interaction_events USING GIN (payload jsonb_path_ops)
        WHERE payload IS NOT NULL
        """
    )

    # --- Enums for new tables ---
    prediction_type = postgresql.ENUM(
        "attention", "gaze", "emotion", "engagement",
        "difficulty", "focus_state", "comprehension", "custom",
        name="prediction_type",
        create_type=False,
    )
    prediction_type.create(op.get_bind(), checkfirst=True)

    period_type = postgresql.ENUM(
        "day", "week", "month",
        name="period_type",
        create_type=False,
    )
    period_type.create(op.get_bind(), checkfirst=True)

    resource_type = postgresql.ENUM(
        "video", "session", "user", "module", "transcript",
        name="resource_type",
        create_type=False,
    )
    resource_type.create(op.get_bind(), checkfirst=True)

    timeline_outcome = postgresql.ENUM(
        "pending", "completed", "skipped", "failed", "in_progress",
        name="timeline_outcome",
        create_type=False,
    )
    timeline_outcome.create(op.get_bind(), checkfirst=True)

    # --- video_transcripts ---
    op.create_table(
        "video_transcripts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "video_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("videos.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("language", sa.String(16), nullable=False, server_default="en"),
        sa.Column("full_text", sa.Text(), nullable=False),
        sa.Column(
            "segments",
            postgresql.JSONB(),
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
        sa.Column("word_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("duration_seconds", sa.Integer(), nullable=True),
        sa.Column("source", sa.String(64), server_default="manual"),
        sa.Column("search_vector", postgresql.TSVECTOR(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.UniqueConstraint("video_id", "language", name="uq_video_transcripts_video_lang"),
    )
    op.create_index("ix_video_transcripts_video_id", "video_transcripts", ["video_id"])
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_video_transcripts_search "
        "ON video_transcripts USING GIN (search_vector)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_video_transcripts_segments "
        "ON video_transcripts USING GIN (segments)"
    )

    # --- ai_predictions ---
    op.create_table(
        "ai_predictions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "session_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("learning_sessions.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "video_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("videos.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("model_name", sa.String(128), nullable=False),
        sa.Column("model_version", sa.String(64), nullable=True),
        sa.Column(
            "prediction_type",
            postgresql.ENUM(
                "attention", "gaze", "emotion", "engagement",
                "difficulty", "focus_state", "comprehension", "custom",
                name="prediction_type",
                create_type=False,
            ),
            nullable=False,
        ),
        sa.Column(
            "source_event_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("interaction_events.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("input_metadata", postgresql.JSONB(), nullable=True),
        sa.Column(
            "output",
            postgresql.JSONB(),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
        sa.Column("confidence", sa.Float(), nullable=True),
        sa.Column("latency_ms", sa.Integer(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index(
        "ix_ai_pred_user_created",
        "ai_predictions",
        ["user_id", sa.text("created_at DESC")],
    )
    op.create_index(
        "ix_ai_pred_user_type_created",
        "ai_predictions",
        ["user_id", "prediction_type", sa.text("created_at DESC")],
    )
    op.create_index("ix_ai_pred_session", "ai_predictions", ["session_id"])
    op.create_index("ix_ai_pred_type_created", "ai_predictions", ["prediction_type", sa.text("created_at DESC")])
    op.create_index("ix_ai_pred_model", "ai_predictions", ["model_name", "model_version"])
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_ai_pred_output_gin "
        "ON ai_predictions USING GIN (output jsonb_path_ops)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_ai_pred_created_brin "
        "ON ai_predictions USING BRIN (created_at)"
    )

    # --- learning_analytics ---
    op.create_table(
        "learning_analytics",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("period_date", sa.Date(), nullable=False),
        sa.Column(
            "period_type",
            postgresql.ENUM("day", "week", "month", name="period_type", create_type=False),
            nullable=False,
            server_default="day",
        ),
        sa.Column("total_watch_seconds", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("session_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("completed_sessions", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("videos_touched", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("avg_attention_score", sa.Float(), nullable=True),
        sa.Column("max_attention_score", sa.Float(), nullable=True),
        sa.Column("min_attention_score", sa.Float(), nullable=True),
        sa.Column("attention_sample_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("focus_lost_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("engagement_score", sa.Float(), nullable=True),
        sa.Column("avg_difficulty", sa.Float(), nullable=True),
        sa.Column(
            "metrics",
            postgresql.JSONB(),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.UniqueConstraint(
            "user_id", "period_date", "period_type",
            name="uq_learning_analytics_user_period",
        ),
    )
    op.create_index(
        "ix_analytics_user_date",
        "learning_analytics",
        ["user_id", sa.text("period_date DESC")],
    )
    op.create_index(
        "ix_analytics_user_type_date",
        "learning_analytics",
        ["user_id", "period_type", sa.text("period_date DESC")],
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_analytics_metrics_gin "
        "ON learning_analytics USING GIN (metrics jsonb_path_ops)"
    )

    # --- difficulty_timeline ---
    op.create_table(
        "difficulty_timeline",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "video_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("videos.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "session_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("learning_sessions.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("sequence_index", sa.Integer(), nullable=False),
        sa.Column("difficulty_level", sa.Float(), nullable=False),
        sa.Column("reason", sa.String(512), nullable=True),
        sa.Column("attention_at_decision", sa.Float(), nullable=True),
        sa.Column(
            "prediction_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("ai_predictions.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "outcome",
            postgresql.ENUM(
                "pending", "completed", "skipped", "failed", "in_progress",
                name="timeline_outcome",
                create_type=False,
            ),
            nullable=False,
            server_default="pending",
        ),
        sa.Column("outcome_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "recommended_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.UniqueConstraint(
            "user_id", "sequence_index",
            name="uq_difficulty_timeline_user_seq",
        ),
    )
    op.create_index(
        "ix_diff_timeline_user_seq",
        "difficulty_timeline",
        ["user_id", "sequence_index"],
    )
    op.create_index(
        "ix_diff_timeline_user_recommended",
        "difficulty_timeline",
        ["user_id", sa.text("recommended_at DESC")],
    )
    op.create_index("ix_diff_timeline_video", "difficulty_timeline", ["video_id"])
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS ix_diff_timeline_outcome
        ON difficulty_timeline (user_id, outcome)
        WHERE outcome = 'pending'
        """
    )

    # --- summary_cache ---
    op.create_table(
        "summary_cache",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("cache_key", sa.String(512), nullable=False),
        sa.Column(
            "resource_type",
            postgresql.ENUM(
                "video", "session", "user", "module", "transcript",
                name="resource_type",
                create_type=False,
            ),
            nullable=False,
        ),
        sa.Column("resource_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("summary_text", sa.Text(), nullable=True),
        sa.Column("summary_json", postgresql.JSONB(), nullable=True),
        sa.Column("model_used", sa.String(128), nullable=True),
        sa.Column("locale", sa.String(16), server_default="en"),
        sa.Column("hit_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.UniqueConstraint("cache_key", name="uq_summary_cache_key"),
    )
    op.create_index(
        "ix_summary_resource",
        "summary_cache",
        ["resource_type", "resource_id"],
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS ix_summary_expires
        ON summary_cache (expires_at)
        WHERE expires_at IS NOT NULL
        """
    )

    # Views
    op.execute(
        """
        CREATE OR REPLACE VIEW v_user_session_stats AS
        SELECT
            s.user_id,
            COUNT(*) AS total_sessions,
            COUNT(*) FILTER (WHERE s.status = 'completed') AS completed_sessions,
            COALESCE(SUM(s.total_watch_seconds), 0) AS total_watch_seconds,
            AVG(s.avg_attention_score) AS avg_attention_score,
            COUNT(DISTINCT s.video_id) AS distinct_videos
        FROM learning_sessions s
        GROUP BY s.user_id
        """
    )
    op.execute(
        """
        CREATE OR REPLACE VIEW v_daily_attention AS
        SELECT
            user_id,
            (started_at AT TIME ZONE 'UTC')::date AS day,
            AVG(avg_attention_score) AS avg_attention,
            COUNT(*) AS session_count,
            COALESCE(SUM(total_watch_seconds), 0) AS watch_seconds
        FROM learning_sessions
        WHERE avg_attention_score IS NOT NULL
        GROUP BY user_id, (started_at AT TIME ZONE 'UTC')::date
        """
    )


def downgrade() -> None:
    op.execute("DROP VIEW IF EXISTS v_daily_attention")
    op.execute("DROP VIEW IF EXISTS v_user_session_stats")
    op.drop_table("summary_cache")
    op.drop_table("difficulty_timeline")
    op.drop_table("learning_analytics")
    op.drop_table("ai_predictions")
    op.drop_table("video_transcripts")

    op.execute("DROP TYPE IF EXISTS timeline_outcome")
    op.execute("DROP TYPE IF EXISTS resource_type")
    op.execute("DROP TYPE IF EXISTS period_type")
    op.execute("DROP TYPE IF EXISTS prediction_type")

    # Drop added indexes / columns on existing tables (best-effort)
    for idx in [
        "ix_events_payload_gin",
        "ix_events_attention_samples",
        "ix_events_created_brin",
        "ix_events_user_type_created",
        "ix_events_user_created",
        "ix_sessions_started_brin",
        "ix_sessions_status_active",
        "ix_sessions_user_status",
        "ix_sessions_user_started",
        "ix_videos_tags",
        "ix_videos_difficulty",
        "ix_videos_published",
        "ix_videos_title_trgm",
        "ix_users_is_active",
        "ix_users_email_lower",
    ]:
        op.execute(f"DROP INDEX IF EXISTS {idx}")

    op.drop_column("learning_sessions", "applied_difficulty")
    op.drop_column("videos", "published_at")
    op.drop_column("videos", "base_difficulty")
    op.drop_column("users", "last_login_at")
    op.drop_column("users", "timezone")
    op.drop_column("users", "preferred_difficulty")
