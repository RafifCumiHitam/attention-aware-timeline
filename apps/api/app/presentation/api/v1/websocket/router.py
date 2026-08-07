"""FastAPI WebSocket endpoint router for realtime learning telemetry."""

import time
from datetime import datetime, timezone

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect
from pydantic import ValidationError

from app.core.logging import get_logger
from app.core.security import decode_token
from app.presentation.api.v1.websocket.connection_manager import manager
from app.presentation.api.v1.websocket.schemas import (
    AdaptationRequestMessage,
    AdaptivePlaybackCommandMessage,
    PongMessage,
    RealtimeStateSyncMessage,
    TelemetryAckMessage,
    TelemetryUpdateMessage,
)

logger = get_logger(__name__)

router = APIRouter()


def evaluate_adaptive_playback(
    session_id: str,
    progress_seconds: float,
    attention_score: float,
    current_emotion: str,
    *,
    event_type: str | None = None,
    seek_delta_seconds: float | None = None,
    is_difficult_section: bool = False,
) -> AdaptivePlaybackCommandMessage:
    """
    Heuristic adaptive engine (baseline — no DL emotion model).

    Target behavior:
    If the learner seeks forward into a difficult section while attention is low,
    reduce playback speed to 0.8x.
    """
    emotion_clean = (current_emotion or "neutral").lower().strip()
    is_seek_forward = (event_type or "").upper() == "SEEK_FORWARD" or (
        seek_delta_seconds is not None and seek_delta_seconds > 0
    )

    # Primary thesis rule: seek-forward + difficult + low attention → 0.8x
    if is_seek_forward and is_difficult_section and attention_score < 0.55:
        return AdaptivePlaybackCommandMessage(
            session_id=session_id,
            playback_rate=0.8,
            action="slowdown",
            reason=(
                f"Seek-forward into difficult section at video t={progress_seconds:.1f}s "
                f"with low attention ({attention_score:.2f}). Slowing to 0.8x."
            ),
            target_timestamp=progress_seconds,
        )

    # Low attention or confused/distracted → slowdown (0.8x baseline)
    if attention_score < 0.40 or emotion_clean in ("confused", "distracted"):
        return AdaptivePlaybackCommandMessage(
            session_id=session_id,
            playback_rate=0.8,
            action="slowdown",
            reason=(
                f"Low attention ({attention_score:.2f}) or '{emotion_clean}' state. "
                f"Slowing to 0.8x for comprehension."
            ),
            target_timestamp=progress_seconds,
        )

    if attention_score < 0.60 or emotion_clean == "bored":
        return AdaptivePlaybackCommandMessage(
            session_id=session_id,
            playback_rate=1.0,
            action="recap_suggestion",
            reason=f"Moderate attention ({attention_score:.2f}). Maintaining 1.0x.",
            target_timestamp=progress_seconds,
        )

    if attention_score >= 0.85 and emotion_clean == "focused":
        return AdaptivePlaybackCommandMessage(
            session_id=session_id,
            playback_rate=1.25,
            action="speedup",
            reason=(
                f"High focus & attention ({attention_score:.2f}). "
                f"Increasing playback to 1.25x."
            ),
            target_timestamp=progress_seconds,
        )

    return AdaptivePlaybackCommandMessage(
        session_id=session_id,
        playback_rate=1.0,
        action="maintain",
        reason=f"Optimal learning flow ({attention_score:.2f}). Maintaining 1.0x.",
        target_timestamp=progress_seconds,
    )


@router.websocket("/learning")
async def websocket_learning_endpoint(
    websocket: WebSocket,
    session_id: str = Query(default="demo-session-1"),
    user_id: str = Query(default="demo-user-1"),
    token: str | None = Query(default=None),
) -> None:
    """
    WebSocket endpoint for realtime video progress, attention score,
    and adaptive playback control. All messages are session-scoped.
    """
    actual_user_id = user_id

    if token:
        try:
            payload = decode_token(token)
            if payload.get("sub"):
                actual_user_id = str(payload.get("sub"))
        except Exception as exc:
            logger.warning(
                "websocket_auth_warning",
                error=str(exc),
                message="Proceeding with guest session ID",
            )

    await manager.connect(websocket, session_id=session_id, user_id=actual_user_id)

    try:
        while True:
            raw_data = await websocket.receive_json()

            if not isinstance(raw_data, dict):
                continue

            msg_type = raw_data.get("type")

            if msg_type == "ping":
                timestamp = raw_data.get("timestamp", time.time())
                await manager.send_personal_json(
                    websocket, PongMessage(timestamp=float(timestamp)).model_dump()
                )
                continue

            if msg_type == "telemetry_update":
                try:
                    telemetry = TelemetryUpdateMessage.model_validate(raw_data)
                except ValidationError as ve:
                    await manager.send_personal_json(
                        websocket,
                        {
                            "type": "error",
                            "message": "Invalid telemetry payload",
                            "details": ve.errors(),
                        },
                    )
                    continue

                # Enforce session binding: prefer connection session_id
                bound_session = session_id or telemetry.session_id

                adaptation = evaluate_adaptive_playback(
                    session_id=bound_session,
                    progress_seconds=telemetry.progress_seconds,
                    attention_score=telemetry.attention_score,
                    current_emotion=telemetry.current_emotion,
                    event_type=telemetry.event_type,
                    seek_delta_seconds=telemetry.seek_delta_seconds,
                    is_difficult_section=telemetry.is_difficult_section,
                )

                ack = TelemetryAckMessage(
                    timestamp=datetime.now(timezone.utc).isoformat(),
                    status="ok",
                )
                await manager.send_personal_json(websocket, ack.model_dump())
                await manager.send_personal_json(websocket, adaptation.model_dump())

                sync_msg = RealtimeStateSyncMessage(
                    session_id=bound_session,
                    progress_seconds=telemetry.progress_seconds,
                    attention_score=telemetry.attention_score,
                    current_emotion=telemetry.current_emotion,
                    playback_rate=adaptation.playback_rate,
                )
                await manager.broadcast_to_session(
                    session_id=bound_session,
                    data=sync_msg.model_dump(),
                    exclude=websocket,
                )

            elif msg_type == "request_adaptation":
                try:
                    req = AdaptationRequestMessage.model_validate(raw_data)
                    adaptation = evaluate_adaptive_playback(
                        session_id=session_id or req.session_id,
                        progress_seconds=0.0,
                        attention_score=req.attention_score,
                        current_emotion=req.current_emotion,
                        event_type=req.event_type,
                        is_difficult_section=req.is_difficult_section,
                    )
                    await manager.send_personal_json(websocket, adaptation.model_dump())
                except ValidationError as ve:
                    await manager.send_personal_json(
                        websocket,
                        {
                            "type": "error",
                            "message": "Invalid adaptation request",
                            "details": ve.errors(),
                        },
                    )

            else:
                logger.debug("websocket_unknown_type", type=msg_type)

    except WebSocketDisconnect:
        await manager.disconnect(websocket, session_id=session_id, user_id=actual_user_id)
    except Exception as exc:
        logger.error("websocket_unexpected_error", error=str(exc))
        await manager.disconnect(websocket, session_id=session_id, user_id=actual_user_id)
