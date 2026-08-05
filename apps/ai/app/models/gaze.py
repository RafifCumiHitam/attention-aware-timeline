"""Gaze / eye-tracking schemas."""

from datetime import datetime

from pydantic import BaseModel, Field


class ScreenPoint(BaseModel):
    """Normalized screen coordinates (0–1)."""

    x: float = Field(ge=0, le=1)
    y: float = Field(ge=0, le=1)


class GazeVector(BaseModel):
    """Head/eye orientation in degrees."""

    yaw: float
    pitch: float
    roll: float = 0.0


class GazeRequest(BaseModel):
    image_base64: str | None = None
    frame_id: str | None = None
    session_id: str | None = None
    video_timestamp: float | None = Field(default=None, ge=0)
    screen_width: int | None = Field(default=None, ge=1)
    screen_height: int | None = Field(default=None, ge=1)


class GazeResult(BaseModel):
    screen_point: ScreenPoint
    gaze_vector: GazeVector
    on_screen: bool
    tracking_confidence: float = Field(ge=0, le=1)
    left_eye_openness: float = Field(ge=0, le=1)
    right_eye_openness: float = Field(ge=0, le=1)
    frame_id: str | None = None
    session_id: str | None = None
    processed_at: datetime
    mock: bool = True
