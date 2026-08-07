"""Sprint 14 — session status values, client_timestamp, composite indexes.

Revision ID: 20260808_0002
Revises: 20260806_0001
Create Date: 2026-08-08
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "20260808_0002"
down_revision: Union[str, None] = "20260806_0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- session_status enum remap (best-effort for Postgres) ---
    op.execute("ALTER TYPE session_status RENAME VALUE 'in_progress' TO 'active'")
    op.execute("ALTER TYPE session_status RENAME VALUE 'completed' TO 'ended'")

    # --- interaction_events.client_timestamp ---
    op.add_column(
        "interaction_events",
        sa.Column("client_timestamp", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(
        "ix_interaction_events_client_timestamp",
        "interaction_events",
        ["client_timestamp"],
    )

    # Composite indexes for reconstruction queries
    op.create_index(
        "ix_events_session_video_ts",
        "interaction_events",
        ["session_id", "video_timestamp"],
    )
    op.create_index(
        "ix_events_video_video_ts",
        "interaction_events",
        ["video_id", "video_timestamp"],
    )

    # Extend event_type enum with new values (Postgres)
    for value in (
        "seek_forward",
        "seek_backward",
        "speed_change",
        "adaptive_decision",
        "tab_hidden",
        "tab_visible",
        "camera_denied",
    ):
        op.execute(f"ALTER TYPE event_type ADD VALUE IF NOT EXISTS '{value}'")


def downgrade() -> None:
    op.drop_index("ix_events_video_video_ts", table_name="interaction_events")
    op.drop_index("ix_events_session_video_ts", table_name="interaction_events")
    op.drop_index("ix_interaction_events_client_timestamp", table_name="interaction_events")
    op.drop_column("interaction_events", "client_timestamp")
    # Enum renames reverse is fragile — left as no-op for safety
