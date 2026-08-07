"""WebSocket message schemas for realtime streaming telemetry."""

from typing import Literal
from pydantic import BaseModel, Field


# --- Client -> Server Message Schemas ---

class PingMessage(BaseModel):
    """Heartbeat ping message from client."""
    type: Literal["ping"] = "ping"
    timestamp: float = Field(description="Client Unix timestamp in seconds")


class TelemetryUpdateMessage(BaseModel):
    """Realtime telemetry sample sent by frontend (player + face pipeline)."""
    type: Literal["telemetry_update"] = "telemetry_update"
    session_id: str = Field(description="Active learning session ID (shared across face, events, WS)")
    video_id: str = Field(description="Video ID being played")
    # Video timeline position (seconds into the media) — NOT wall-clock
    progress_seconds: float = Field(ge=0.0, description="Current video playback position (video time)")
    progress_percent: float = Field(ge=0.0, le=100.0, description="Playback completion percentage")
    attention_score: float = Field(ge=0.0, le=1.0, description="Realtime attention score from face heuristics")
    current_emotion: str = Field(
        default="neutral",
        description="Emotion label (heuristic placeholder until DL model is wired)",
    )
    gaze_x: float | None = Field(default=None, description="Normalized gaze X (0-1)")
    gaze_y: float | None = Field(default=None, description="Normalized gaze Y (0-1)")
    # Optional pipeline context
    event_type: str | None = Field(
        default=None,
        description="Player event that triggered this sample e.g. TIME_UPDATE, SEEK_FORWARD",
    )
    wall_clock_ms: float | None = Field(
        default=None,
        description="Client wall-clock epoch ms (distinct from progress_seconds video time)",
    )
    seek_delta_seconds: float | None = Field(
        default=None,
        description="Seek delta in video-seconds when event_type is SEEK_FORWARD/BACKWARD",
    )
    is_difficult_section: bool = Field(
        default=False,
        description="True when current video position is tagged as difficult content",
    )


class AdaptationRequestMessage(BaseModel):
    """Client request for adaptive playback speed evaluation."""
    type: Literal["request_adaptation"] = "request_adaptation"
    session_id: str
    current_speed: float = Field(default=1.0, gt=0.0)
    attention_score: float = Field(ge=0.0, le=1.0)
    current_emotion: str = Field(default="neutral")
    is_difficult_section: bool = Field(default=False)
    event_type: str | None = Field(default=None)


# --- Server -> Client Response Schemas ---

class PongMessage(BaseModel):
    """Heartbeat pong response to client."""
    type: Literal["pong"] = "pong"
    timestamp: float


class TelemetryAckMessage(BaseModel):
    """Acknowledgment sent back after telemetry processing."""
    type: Literal["telemetry_ack"] = "telemetry_ack"
    timestamp: str
    status: str = "ok"


class AdaptivePlaybackCommandMessage(BaseModel):
    """Adaptive playback speed command returned by backend adaptive engine."""
    type: Literal["adaptive_playback_command"] = "adaptive_playback_command"
    session_id: str
    playback_rate: float = Field(description="Recommended video playback rate e.g. 0.8, 1.0, 1.25")
    action: Literal["slowdown", "speedup", "pause_prompt", "recap_suggestion", "maintain"] = "maintain"
    reason: str = Field(description="Human-readable reason for adaptation")
    target_timestamp: float | None = Field(
        default=None, description="Video timestamp (video time) where adaptation applied"
    )


class RealtimeStateSyncMessage(BaseModel):
    """State synchronization broadcast across active clients/tabs."""
    type: Literal["realtime_state_sync"] = "realtime_state_sync"
    session_id: str
    progress_seconds: float
    attention_score: float
    current_emotion: str
    playback_rate: float
