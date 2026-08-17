"""Analytics endpoints — real DB-backed aggregates + research export."""

import csv
import io
import json
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import Response, StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.services.analytics_service import AnalyticsService
from app.infrastructure.database.base import get_db
from app.infrastructure.database.models.event import InteractionEvent
from app.infrastructure.database.models.session import LearningSession
from app.infrastructure.database.models.user import User
from app.presentation.api.schemas.analytics import (
    AnalyticsAttentionResponse,
    AnalyticsEventsResponse,
    AnalyticsOverviewResponse,
    AnalyticsTimelineResponse,
)
from app.presentation.dependencies.auth import get_current_user

router = APIRouter()


@router.get(
    "/overview",
    response_model=AnalyticsOverviewResponse,
    summary="Learning analytics overview (sessions + events)",
)
async def analytics_overview(
    trend_days: int = Query(7, ge=1, le=90),
    session_id: UUID | None = Query(None),
    video_id: UUID | None = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AnalyticsOverviewResponse:
    return await AnalyticsService(db).get_overview(
        current_user,
        trend_days=trend_days,
        session_id=session_id,
        video_id=video_id,
    )


@router.get(
    "/timeline",
    response_model=AnalyticsTimelineResponse,
    summary="Time-bucketed event analytics by video_timestamp",
)
async def analytics_timeline(
    session_id: UUID | None = Query(None),
    video_id: UUID | None = Query(None),
    bucket_seconds: float = Query(30.0, ge=5.0, le=300.0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AnalyticsTimelineResponse:
    return await AnalyticsService(db).get_timeline(
        current_user,
        session_id=session_id,
        video_id=video_id,
        bucket_seconds=bucket_seconds,
    )


@router.get(
    "/attention",
    response_model=AnalyticsAttentionResponse,
    summary="Attention samples ordered by video_timestamp",
)
async def analytics_attention(
    session_id: UUID | None = Query(None),
    video_id: UUID | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(200, ge=1, le=1000),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AnalyticsAttentionResponse:
    return await AnalyticsService(db).get_attention(
        current_user,
        session_id=session_id,
        video_id=video_id,
        page=page,
        page_size=page_size,
    )


@router.get(
    "/events",
    response_model=AnalyticsEventsResponse,
    summary="Seek interaction events for analytics",
)
async def analytics_events(
    session_id: UUID | None = Query(None),
    video_id: UUID | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(100, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AnalyticsEventsResponse:
    return await AnalyticsService(db).get_events(
        current_user,
        session_id=session_id,
        video_id=video_id,
        page=page,
        page_size=page_size,
    )


def _row_export(ev: InteractionEvent, session: LearningSession) -> dict:
    payload = ev.payload or {}
    return {
        "event_id": str(ev.id),
        "session_id": str(ev.session_id) if ev.session_id else None,
        "user_id": str(ev.user_id),
        "video_id": str(ev.video_id) if ev.video_id else None,
        "module_id": str(session.module_id) if session.module_id else None,
        "event_type": ev.event_type.value if hasattr(ev.event_type, "value") else str(ev.event_type),
        "timestamp_event": ev.client_timestamp.isoformat() if ev.client_timestamp else None,
        "created_at": ev.created_at.isoformat() if ev.created_at else None,
        "video_timestamp": ev.video_timestamp,
        "video_time_from": payload.get("video_time_from", payload.get("from")),
        "video_time_to": payload.get("video_time_to", payload.get("to")),
        "seek_distance": payload.get("seek_distance", payload.get("delta")),
        "target_zone_id": payload.get("target_zone_id"),
        "is_meaningful": payload.get("is_meaningful"),
        "seek_direction": payload.get("seek_direction"),
        "attention_score": ev.attention_score,
        "triggered_intervention": payload.get("triggered_intervention"),
        "triggered_remedial": payload.get("triggered_remedial"),
        "playback_rate": payload.get("playback_speed") or payload.get("playback_rate"),
        "speed_change_source": payload.get("speed_change_source"),
        "event_type_raw": payload.get("event_type_raw"),
        "payload_json": json.dumps(payload, default=str),
    }


@router.get(
    "/sessions/{session_id}/export",
    summary="Research export for one learning session (CSV or JSON)",
)
async def export_session(
    session_id: UUID,
    format: str = Query("json", pattern="^(json|csv)$"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Owner-only export — never another user's session."""
    result = await db.execute(
        select(LearningSession).where(LearningSession.id == session_id)
    )
    session = result.scalar_one_or_none()
    if session is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    if session.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your session")

    ev_result = await db.execute(
        select(InteractionEvent)
        .where(InteractionEvent.session_id == session_id)
        .order_by(InteractionEvent.video_timestamp.nulls_last(), InteractionEvent.created_at)
    )
    events = list(ev_result.scalars().all())
    rows = [_row_export(e, session) for e in events]

    if format == "json":
        body = {
            "session_id": str(session.id),
            "user_id": str(session.user_id),
            "video_id": str(session.video_id),
            "module_id": str(session.module_id) if session.module_id else None,
            "status": session.status.value if hasattr(session.status, "value") else str(session.status),
            "started_at": session.started_at.isoformat() if session.started_at else None,
            "ended_at": session.ended_at.isoformat() if session.ended_at else None,
            "event_count": len(rows),
            "events": rows,
        }
        return Response(
            content=json.dumps(body, indent=2, default=str),
            media_type="application/json",
            headers={
                "Content-Disposition": f'attachment; filename="session_{session_id}.json"'
            },
        )

    # CSV
    if not rows:
        fieldnames = [
            "event_id",
            "session_id",
            "user_id",
            "video_id",
            "module_id",
            "event_type",
            "timestamp_event",
            "video_timestamp",
            "video_time_from",
            "video_time_to",
            "seek_distance",
            "target_zone_id",
            "is_meaningful",
            "attention_score",
            "triggered_intervention",
            "triggered_remedial",
            "playback_rate",
        ]
    else:
        fieldnames = list(rows[0].keys())

    buf = io.StringIO()
    writer = csv.DictWriter(buf, fieldnames=fieldnames, extrasaction="ignore")
    writer.writeheader()
    for r in rows:
        writer.writerow(r)
    buf.seek(0)

    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={
            "Content-Disposition": f'attachment; filename="session_{session_id}.csv"'
        },
    )
