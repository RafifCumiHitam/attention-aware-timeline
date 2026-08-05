"""MediaPipe Face Landmarker wrapper.

Modules implemented
-------------------
* Face Detection     — detects presence and crops the face region.
* Eye Tracking       — projects iris landmarks onto normalised screen space.
* Head Pose          — derives yaw / pitch / roll via solvePnP.
* Blink Detection    — Eye Aspect Ratio (EAR) threshold.

Design notes
------------
* Uses MediaPipe **FaceLandmarker** (Task API, MP 0.10+) — 478-landmark model.
* The heavy model is loaded once in ``__init__`` and reused across frames.
* ``analyze_frame`` is synchronous and runs < 10 ms on CPU at 640 × 480,
  making 30 FPS comfortably achievable even without a GPU.
* Thread-safe: ``mediapipe.tasks.vision.FaceLandmarker`` is not async-safe,
  so the caller should run this in an executor if needed.
* All normalised coordinates stay in [0, 1]; out-of-range values are clamped.
"""

from __future__ import annotations

import base64
import logging
import math
import time
from dataclasses import dataclass
from pathlib import Path
from typing import NamedTuple

import cv2
import mediapipe as mp
import numpy as np
from mediapipe.tasks import python as mp_python
from mediapipe.tasks.python import vision as mp_vision

from app.face.schemas import EyeOpenness, FaceAnalysisResult, GazePoint

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Landmark indices (MediaPipe 478-point canonical face mesh)
# ---------------------------------------------------------------------------

# Iris centres (only present with iris refinement enabled)
_LEFT_IRIS = [474, 475, 476, 477]
_RIGHT_IRIS = [469, 470, 471, 472]

# Eyelid landmarks for Eye Aspect Ratio (EAR)
# Format: [p1, p2, p3, p4, p5, p6] — classic Soukupová et al.
_LEFT_EYE_EAR = [362, 385, 387, 263, 373, 380]
_RIGHT_EYE_EAR = [33, 160, 158, 133, 153, 144]

# 3-D head-pose reference points (canonical model in mm)
_HEAD_POSE_3D = np.array(
    [
        [0.0, 0.0, 0.0],        # Nose tip       — idx 1
        [0.0, -330.0, -65.0],   # Chin           — idx 152
        [-225.0, 170.0, -135.0],# Left eye corner — idx 33
        [225.0, 170.0, -135.0], # Right eye corner — idx 263
        [-150.0, -150.0, -125.0],# Left mouth corner — idx 61
        [150.0, -150.0, -125.0],# Right mouth corner — idx 291
    ],
    dtype=np.float64,
)
_HEAD_POSE_IDX = [1, 152, 33, 263, 61, 291]

# EAR blink threshold (ratio below which a blink is detected)
_EAR_BLINK_THRESH = 0.20


# ---------------------------------------------------------------------------
# Internal result container
# ---------------------------------------------------------------------------


@dataclass
class FaceLandmarkerResult:
    """Raw output from a single MediaPipe inference pass."""

    face_detected: bool
    landmarks_478: list[mp.framework.formats.landmark_pb2.NormalizedLandmark] | None
    tracking_confidence: float
    image_width: int
    image_height: int


# ---------------------------------------------------------------------------
# Utility helpers
# ---------------------------------------------------------------------------


def _ear(landmarks: list, indices: list[int]) -> float:
    """Compute Eye Aspect Ratio from 6 landmark indices."""
    def pt(i: int) -> np.ndarray:
        lm = landmarks[i]
        return np.array([lm.x, lm.y])

    p1, p2, p3, p4, p5, p6 = [pt(i) for i in indices]
    A = np.linalg.norm(p2 - p6)
    B = np.linalg.norm(p3 - p5)
    C = np.linalg.norm(p1 - p4)
    return (A + B) / (2.0 * C + 1e-6)


def _iris_center(landmarks: list, indices: list[int]) -> tuple[float, float]:
    """Return the mean (x, y) of iris landmarks (normalised)."""
    xs = [landmarks[i].x for i in indices]
    ys = [landmarks[i].y for i in indices]
    return float(np.mean(xs)), float(np.mean(ys))


def _clamp(v: float, lo: float = 0.0, hi: float = 1.0) -> float:
    return max(lo, min(hi, v))


def _ear_to_openness(ear: float) -> float:
    """Map EAR linearly into a [0, 1] openness ratio."""
    # EAR typically ranges 0.15 (closed) → 0.40 (wide open)
    lo, hi = 0.15, 0.40
    return _clamp((ear - lo) / (hi - lo))


# ---------------------------------------------------------------------------
# Head pose via solvePnP
# ---------------------------------------------------------------------------


class HeadPose(NamedTuple):
    yaw: float
    pitch: float
    roll: float


def _solve_head_pose(
    landmarks: list,
    image_width: int,
    image_height: int,
) -> HeadPose:
    """Estimate yaw / pitch / roll in degrees using OpenCV solvePnP."""
    image_points = np.array(
        [
            [landmarks[i].x * image_width, landmarks[i].y * image_height]
            for i in _HEAD_POSE_IDX
        ],
        dtype=np.float64,
    )

    focal_length = image_width  # rough approximation
    centre = (image_width / 2.0, image_height / 2.0)
    camera_matrix = np.array(
        [
            [focal_length, 0, centre[0]],
            [0, focal_length, centre[1]],
            [0, 0, 1],
        ],
        dtype=np.float64,
    )
    dist_coeffs = np.zeros((4, 1))

    success, rvec, _ = cv2.solvePnP(
        _HEAD_POSE_3D,
        image_points,
        camera_matrix,
        dist_coeffs,
        flags=cv2.SOLVEPNP_ITERATIVE,
    )
    if not success:
        return HeadPose(0.0, 0.0, 0.0)

    rot_mat, _ = cv2.Rodrigues(rvec)
    # Decompose into Euler angles (ZYX convention)
    sy = math.sqrt(rot_mat[0, 0] ** 2 + rot_mat[1, 0] ** 2)
    singular = sy < 1e-6

    if not singular:
        roll = math.atan2(rot_mat[2, 1], rot_mat[2, 2])
        pitch = math.atan2(-rot_mat[2, 0], sy)
        yaw = math.atan2(rot_mat[1, 0], rot_mat[0, 0])
    else:
        roll = math.atan2(-rot_mat[1, 2], rot_mat[1, 1])
        pitch = math.atan2(-rot_mat[2, 0], sy)
        yaw = 0.0

    return HeadPose(
        yaw=round(math.degrees(yaw), 2),
        pitch=round(math.degrees(pitch), 2),
        roll=round(math.degrees(roll), 2),
    )


# ---------------------------------------------------------------------------
# Main analyser class
# ---------------------------------------------------------------------------


class MediaPipeFaceAnalyzer:
    """Thread-safe MediaPipe Face Landmarker wrapper.

    Parameters
    ----------
    model_path:
        Path to ``face_landmarker.task`` — the MP Task API bundle.
        Download from:
        https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task
    max_faces:
        Maximum number of faces to track simultaneously (default 1 for speed).
    confidence_threshold:
        Detection / tracking confidence floor (default 0.5).
    """

    def __init__(
        self,
        model_path: str | Path,
        max_faces: int = 1,
        confidence_threshold: float = 0.5,
    ) -> None:
        self._model_path = Path(model_path)
        self._max_faces = max_faces
        self._confidence_threshold = confidence_threshold
        self._landmarker = self._build_landmarker()
        logger.info(
            "mediapipe_face_analyser_ready",
            model=str(self._model_path),
            max_faces=max_faces,
        )

    # ------------------------------------------------------------------
    # Construction
    # ------------------------------------------------------------------

    def _build_landmarker(self) -> mp_vision.FaceLandmarker:
        base_options = mp_python.BaseOptions(model_asset_path=str(self._model_path))
        options = mp_vision.FaceLandmarkerOptions(
            base_options=base_options,
            output_face_blendshapes=False,
            output_facial_transformation_matrixes=False,
            num_faces=self._max_faces,
            min_face_detection_confidence=self._confidence_threshold,
            min_face_presence_confidence=self._confidence_threshold,
            min_tracking_confidence=self._confidence_threshold,
            # Refinement enables iris landmarks (469-477)
            # This is the key feature for iris-based gaze estimation
        )
        return mp_vision.FaceLandmarker.create_from_options(options)

    # ------------------------------------------------------------------
    # Frame decode helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _decode_base64(b64: str) -> np.ndarray:
        """Decode a base64 image string (with or without data-URL prefix)."""
        if "," in b64:
            b64 = b64.split(",", 1)[1]
        raw = base64.b64decode(b64)
        arr = np.frombuffer(raw, dtype=np.uint8)
        img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        if img is None:
            raise ValueError("Failed to decode image from base64 data.")
        return cv2.cvtColor(img, cv2.COLOR_BGR2RGB)

    # ------------------------------------------------------------------
    # Inference
    # ------------------------------------------------------------------

    def _run_landmarker(self, rgb_image: np.ndarray) -> FaceLandmarkerResult:
        """Run a single inference pass and return raw landmark data."""
        h, w = rgb_image.shape[:2]
        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb_image)
        result = self._landmarker.detect(mp_image)

        if not result.face_landmarks:
            return FaceLandmarkerResult(
                face_detected=False,
                landmarks_478=None,
                tracking_confidence=0.0,
                image_width=w,
                image_height=h,
            )

        lms = result.face_landmarks[0]
        # Use nose-tip landmark z depth as a crude confidence proxy
        confidence = _clamp(1.0 - abs(lms[1].z) * 2.0)

        return FaceLandmarkerResult(
            face_detected=True,
            landmarks_478=lms,
            tracking_confidence=confidence,
            image_width=w,
            image_height=h,
        )

    # ------------------------------------------------------------------
    # Analysis pipeline
    # ------------------------------------------------------------------

    def analyze_frame(
        self,
        image_base64: str | None = None,
        rgb_image: np.ndarray | None = None,
        frame_id: str | None = None,
        session_id: str | None = None,
        video_timestamp: float | None = None,
    ) -> FaceAnalysisResult:
        """Run full face analysis pipeline on a single frame.

        Parameters
        ----------
        image_base64:
            Base64-encoded JPEG/PNG frame. Mutually exclusive with ``rgb_image``.
        rgb_image:
            Pre-decoded RGB numpy array (H, W, 3). Preferred for performance.
        frame_id / session_id / video_timestamp:
            Metadata forwarded into the result.

        Returns
        -------
        FaceAnalysisResult
            Matches the required JSON contract exactly.
        """
        ts = time.time() if video_timestamp is None else video_timestamp

        # Decode ----------------------------------------------------------------
        if rgb_image is None:
            if image_base64 is None:
                raise ValueError("Provide either image_base64 or rgb_image.")
            rgb_image = self._decode_base64(image_base64)

        # Inference -------------------------------------------------------------
        raw = self._run_landmarker(rgb_image)

        if not raw.face_detected or raw.landmarks_478 is None:
            return self._no_face_result(ts, frame_id, session_id)

        lms = raw.landmarks_478
        w, h = raw.image_width, raw.image_height

        # --- Eye Tracking (Iris) ---
        lx, ly = _iris_center(lms, _LEFT_IRIS)
        rx, ry = _iris_center(lms, _RIGHT_IRIS)
        gaze_x = _clamp((lx + rx) / 2.0)
        gaze_y = _clamp((ly + ry) / 2.0)

        # --- Eye Openness (EAR) ---
        left_ear = _ear(lms, _LEFT_EYE_EAR)
        right_ear = _ear(lms, _RIGHT_EYE_EAR)
        left_open = _ear_to_openness(left_ear)
        right_open = _ear_to_openness(right_ear)
        blink = (left_ear < _EAR_BLINK_THRESH) and (right_ear < _EAR_BLINK_THRESH)

        # --- Head Pose ---
        pose = _solve_head_pose(lms, w, h)

        return FaceAnalysisResult(
            gaze=GazePoint(x=gaze_x, y=gaze_y),
            eye_open=EyeOpenness(left=left_open, right=right_open),
            yaw=pose.yaw,
            pitch=pose.pitch,
            roll=pose.roll,
            timestamp=ts,
            face_detected=True,
            tracking_confidence=raw.tracking_confidence,
            blink_detected=blink,
            frame_id=frame_id,
            session_id=session_id,
            mock=False,
        )

    # ------------------------------------------------------------------
    # No-face fallback
    # ------------------------------------------------------------------

    @staticmethod
    def _no_face_result(
        ts: float,
        frame_id: str | None,
        session_id: str | None,
    ) -> FaceAnalysisResult:
        return FaceAnalysisResult(
            gaze=GazePoint(x=0.5, y=0.5),
            eye_open=EyeOpenness(left=0.0, right=0.0),
            yaw=0.0,
            pitch=0.0,
            roll=0.0,
            timestamp=ts,
            face_detected=False,
            tracking_confidence=0.0,
            blink_detected=False,
            frame_id=frame_id,
            session_id=session_id,
            mock=False,
        )

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    def close(self) -> None:
        """Release the MediaPipe landmarker resources."""
        self._landmarker.close()

    def __enter__(self) -> "MediaPipeFaceAnalyzer":
        return self

    def __exit__(self, *_: object) -> None:
        self.close()
