"""FastAPI WebSocket endpoint router for realtime learning telemetry."""

import time
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect
from pydantic import ValidationError

from app.core.config import get_settings
from app.core.logging import get_logger
from app.core.security import decode_token
from app.presentation.api.v1.websocket.connection_manager import manager
from app.presentation.api.v1.websocket.schemas import (
    AdaptationRequestMessage,
    AdaptivePlaybackCommandMessage,
    PingMessage,
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
) -> AdaptivePlaybackCommandMessage:
    """Production rule-based adaptive engine for realtime video playback control."""
    emotion_clean = current_emotion.lower().strip()

    if attention_score < 0.40 or emotion_clean in ["confused", "distracted"]:
        return AdaptivePlaybackCommandMessage(
            session_id=session_id,
            playback_rate=0.75,
            action="slowdown",
            reason=f"Low attention ({attention_score:.2f}) or '{emotion_clean}' state detected. Slowing to 0.75x for comprehension.",
            target_timestamp=progress_seconds,
        )
    elif attention_score < 0.60 or emotion_clean == "bored":
        return AdaptivePlaybackCommandMessage(
            session_id=session_id,
            playback_rate=1.0,
            action="recap_suggestion",
            reason=f"Moderate attention ({attention_score:.2f}). Maintaining 1.0x playback speed.",
            target_timestamp=progress_seconds,
        )
    elif attention_score >= 0.85 and emotion_clean == "focused":
        return AdaptivePlaybackCommandMessage(
            session_id=session_id,
            playback_rate=1.25,
            action="speedup",
            reason=f"High focus & attention ({attention_score:.2f}) detected. Increasing playback to 1.25x.",
            target_timestamp=progress_seconds,
        )
    else:
        return AdaptivePlaybackCommandMessage(
            session_id=session_id,
            playback_rate=1.0,
            action="maintain",
            reason=f"Optimal learning flow ({attention_score:.2f}). Maintaining 1.0x playback.",
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
    WebSocket endpoint for realtime video progress, attention score, emotion detection,
    and adaptive playback control.
    """
    actual_user_id = user_id

    # Authenticate token if provided
    if token:
        try:
            payload = decode_token(token)
            if payload.get("sub"):
                actual_user_id = str(payload.get("sub"))
        except Exception as exc:
            logger.warning("websocket_auth_warning", error=str(exc), message="Proceeding with guest session ID")

    await manager.connect(websocket, session_id=session_id, user_id=actual_user_id)

    try:
        while True:
            raw_data = await websocket.receive_json()

            if not isinstance(raw_data, dict):
                continue

            msg_type = raw_data.get("type")

            # 1. Heartbeat Ping-Pong
            if msg_type == "ping":
                timestamp = raw_data.get("timestamp", time.time())
                await manager.send_personal_json(
                    websocket, PongMessage(timestamp=float(timestamp)).model_dump()
                )
                continue

            # 2. Realtime Telemetry Update
            if msg_type == "telemetry_update":
                try:
                    telemetry = TelemetryUpdateMessage.model_validate(raw_data)
                except ValidationError as ve:
                    await manager.send_personal_json(
                        websocket,
                        {"type": "error", "message": "Invalid telemetry payload", "details": ve.errors()},
                    )
                    continue

                # Generate adaptive playback directive
                adaptation = evaluate_adaptive_playback(
                    session_id=telemetry.session_id,
                    progress_seconds=telemetry.progress_seconds,
                    attention_score=telemetry.attention_score,
                    current_emotion=telemetry.current_emotion,
                )

                # Send Acknowledgment
                ack = TelemetryAckMessage(
                    timestamp=datetime.now(timezone.utc).isoformat(),
                    status="ok",
                )
                await manager.send_personal_json(websocket, ack.model_dump())

                # Send Adaptive Command back to sender
                await manager.send_personal_json(websocket, adaptation.model_dump())

                # Broadcast state sync to other connected clients/tabs for this session
                sync_msg = RealtimeStateSyncMessage(
                    session_id=telemetry.session_id,
                    progress_seconds=telemetry.progress_seconds,
                    attention_score=telemetry.attention_score,
                    current_emotion=telemetry.current_emotion,
                    playback_rate=adaptation.playback_rate,
                )
                await manager.broadcast_to_session(
                    session_id=telemetry.session_id,
                    data=sync_msg.model_dump(),
                    exclude=websocket,
                )

            # 3. Explicit Adaptation Request
            elif msg_type == "request_adaptation":
                try:
                    req = AdaptationRequestMessage.model_validate(raw_data)
                    adaptation = evaluate_adaptive_playback(
                        session_id=req.session_id,
                        progress_seconds=0.0,
                        attention_score=req.attention_score,
                        current_emotion=req.current_emotion,
                    )
                    await manager.send_personal_json(websocket, adaptation.model_dump())
                except ValidationError as ve:
                    await manager.send_personal_json(
                        websocket,
                        {"type": "error", "message": "Invalid adaptation request", "details": ve.errors()},
                    )

            else:
                logger.debug("websocket_unknown_type", type=msg_type)

    except WebSocketDisconnect:
        await manager.disconnect(websocket, session_id=session_id, user_id=actual_user_id)
    except Exception as exc:
        logger.error("websocket_unexpected_error", error=str(exc))
        await manager.disconnect(websocket, session_id=session_id, user_id=actual_user_id)
