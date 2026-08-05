"""Unit tests for the face analysis schemas and mock path.

Run with:
    pytest tests/test_face_analysis.py -v

These tests do NOT require MediaPipe to be installed or a model file to be
present; they validate the schema contract and the no-model fallback path.
"""

from __future__ import annotations

import base64
import io
import time

import pytest

# ---------------------------------------------------------------------------
# Schema contract tests — no MediaPipe import needed
# ---------------------------------------------------------------------------


def test_face_analysis_result_schema():
    from app.face.schemas import EyeOpenness, FaceAnalysisResult, GazePoint

    result = FaceAnalysisResult(
        gaze=GazePoint(x=0.5, y=0.5),
        eye_open=EyeOpenness(left=0.8, right=0.82),
        yaw=5.0,
        pitch=-3.0,
        roll=1.0,
        timestamp=time.time(),
    )
    d = result.model_dump()
    assert set(d.keys()) >= {"gaze", "eye_open", "yaw", "pitch", "roll", "timestamp"}
    assert "x" in d["gaze"] and "y" in d["gaze"]
    assert "left" in d["eye_open"] and "right" in d["eye_open"]


def test_gaze_point_clamped():
    from pydantic import ValidationError

    from app.face.schemas import GazePoint

    with pytest.raises(ValidationError):
        GazePoint(x=1.5, y=0.5)  # x out of [0, 1]


def test_eye_openness_clamped():
    from pydantic import ValidationError

    from app.face.schemas import EyeOpenness

    with pytest.raises(ValidationError):
        EyeOpenness(left=-0.1, right=0.5)  # left < 0


def test_face_analysis_request_optional_fields():
    from app.face.schemas import FaceAnalysisRequest

    req = FaceAnalysisRequest(image_base64="abc123")
    assert req.frame_id is None
    assert req.session_id is None
    assert req.video_timestamp is None


# ---------------------------------------------------------------------------
# Dependency injection: get_face_analyzer returns None in mock mode
# ---------------------------------------------------------------------------


def test_get_face_analyzer_returns_none_in_mock_mode(monkeypatch):
    """When MOCK_INFERENCE=True, get_face_analyzer must return None."""
    import app.dependencies as deps

    monkeypatch.setattr(
        deps,
        "get_settings",
        lambda: type("S", (), {"mock_inference": True})(),
    )
    # Clear any cached result to force re-evaluation
    deps._get_face_analyzer_cached.cache_clear()

    result = deps.get_face_analyzer()
    assert result is None


# ---------------------------------------------------------------------------
# Helpers: _ear, _iris_center, _ear_to_openness
# ---------------------------------------------------------------------------


class _FakeLandmark:
    def __init__(self, x: float, y: float, z: float = 0.0):
        self.x = x
        self.y = y
        self.z = z


def _make_open_eye_landmarks(indices: list[int]) -> dict[int, _FakeLandmark]:
    """Return open-eye EAR landmarks: A=B=0.3, C=0.5 → EAR ≈ 0.6."""
    p1, p2, p3, p4, p5, p6 = indices
    return {
        p1: _FakeLandmark(0.0, 0.0),
        p4: _FakeLandmark(1.0, 0.0),  # C = 1.0
        p2: _FakeLandmark(0.25, -0.3),
        p6: _FakeLandmark(0.75, 0.3),  # A = 0.3
        p3: _FakeLandmark(0.25, 0.3),
        p5: _FakeLandmark(0.75, -0.3),  # B = 0.3
    }


def test_ear_open_eye():
    from app.face.landmarker import _LEFT_EYE_EAR, _ear

    lm_dict = _make_open_eye_landmarks(_LEFT_EYE_EAR)
    # Build a list large enough to index by landmark number
    max_idx = max(_LEFT_EYE_EAR) + 1
    landmarks = [_FakeLandmark(0, 0)] * max_idx
    for i, lm in lm_dict.items():
        landmarks[i] = lm

    ear = _ear(landmarks, _LEFT_EYE_EAR)
    assert ear > 0.0


def test_ear_to_openness_range():
    from app.face.landmarker import _ear_to_openness

    assert _ear_to_openness(0.40) == pytest.approx(1.0)
    assert _ear_to_openness(0.15) == pytest.approx(0.0)
    assert 0.0 <= _ear_to_openness(0.28) <= 1.0


def test_iris_center():
    from app.face.landmarker import _iris_center

    landmarks = [_FakeLandmark(0, 0)] * 478
    iris_indices = [474, 475, 476, 477]
    for i, idx in enumerate(iris_indices):
        landmarks[idx] = _FakeLandmark(x=0.5 + i * 0.01, y=0.3)

    cx, cy = _iris_center(landmarks, iris_indices)
    assert 0.5 <= cx <= 0.53
    assert cy == pytest.approx(0.3)
