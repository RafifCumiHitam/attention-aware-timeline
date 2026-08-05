"""Pydantic schemas for face analysis I/O.

The output shape mirrors the requested JSON contract:

    {
        "gaze":      {"x": float, "y": float},
        "eye_open":  {"left": float, "right": float},
        "yaw":       float,
        "pitch":     float,
        "roll":      float,
        "timestamp": float   # seconds since epoch
    }
"""

from __future__ import annotations

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Request
# ---------------------------------------------------------------------------


class FaceAnalysisRequest(BaseModel):
    """Single-frame analysis request.

    Exactly one of ``image_base64`` or ``image_url`` must be provided.
    All other fields are optional metadata forwarded verbatim into the result.
    """

    image_base64: str | None = Field(
        default=None,
        description="JPEG / PNG image encoded as a base64 string (data-URL prefix stripped).",
    )
    image_url: str | None = Field(
        default=None,
        description="Publicly reachable URL to a JPEG / PNG frame.",
    )
    frame_id: str | None = None
    session_id: str | None = None
    video_timestamp: float | None = Field(default=None, ge=0)
    # Optional screen dimensions used to convert normalised gaze to pixels
    screen_width: int | None = Field(default=None, ge=1)
    screen_height: int | None = Field(default=None, ge=1)


# ---------------------------------------------------------------------------
# Sub-results
# ---------------------------------------------------------------------------


class GazePoint(BaseModel):
    """Normalised on-screen focus point (0–1 range)."""

    x: float = Field(ge=0.0, le=1.0)
    y: float = Field(ge=0.0, le=1.0)


class EyeOpenness(BaseModel):
    """Eye-openness ratio (0 = fully closed, 1 = fully open)."""

    left: float = Field(ge=0.0, le=1.0)
    right: float = Field(ge=0.0, le=1.0)


# ---------------------------------------------------------------------------
# Result — matches the required JSON contract exactly
# ---------------------------------------------------------------------------


class FaceAnalysisResult(BaseModel):
    """Per-frame face analysis result.

    Contract
    --------
    ``gaze``      — normalised on-screen gaze point (x, y ∈ [0, 1]).
    ``eye_open``  — eye-openness ratio per eye (0–1).
    ``yaw``       — head horizontal rotation in degrees (+right).
    ``pitch``     — head vertical rotation in degrees (+up).
    ``roll``      — head tilt in degrees (+clockwise).
    ``timestamp`` — Unix timestamp in seconds (UTC).
    """

    gaze: GazePoint
    eye_open: EyeOpenness
    yaw: float = Field(description="Head yaw in degrees.")
    pitch: float = Field(description="Head pitch in degrees.")
    roll: float = Field(description="Head roll in degrees.")
    timestamp: float = Field(description="Unix timestamp (seconds, UTC).")

    # Diagnostic / metadata fields
    face_detected: bool = True
    tracking_confidence: float = Field(default=1.0, ge=0.0, le=1.0)
    blink_detected: bool = False
    frame_id: str | None = None
    session_id: str | None = None
    mock: bool = False
