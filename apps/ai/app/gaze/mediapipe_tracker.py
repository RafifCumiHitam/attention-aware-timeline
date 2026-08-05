"""Real MediaPipe-backed GazeTracker.

Satisfies the ``GazeTracker`` protocol defined in ``app.gaze.interfaces``.
Delegates all heavy lifting to ``MediaPipeFaceAnalyzer``.
"""

from __future__ import annotations

import asyncio
import logging
from functools import partial

from app.face.landmarker import MediaPipeFaceAnalyzer
from app.models.gaze import GazeRequest, GazeResult, GazeVector, ScreenPoint

logger = logging.getLogger(__name__)


class MediaPipeGazeTracker:
    """Production GazeTracker backed by MediaPipe Face Landmarker.

    The underlying ``FaceLandmarker.detect`` call is CPU-bound (< 10 ms),
    so we off-load it to the default ThreadPoolExecutor to stay non-blocking.
    """

    def __init__(self, analyzer: MediaPipeFaceAnalyzer) -> None:
        self._analyzer = analyzer

    async def track(self, request: GazeRequest) -> GazeResult:
        """Analyse a single frame and return gaze / head-pose / eye data."""
        if not request.image_base64:
            logger.warning("gaze_track_no_image", frame_id=request.frame_id)
            return self._fallback(request)

        loop = asyncio.get_running_loop()
        fn = partial(
            self._analyzer.analyze_frame,
            image_base64=request.image_base64,
            frame_id=request.frame_id,
            session_id=request.session_id,
            video_timestamp=request.video_timestamp,
        )

        try:
            face_result = await loop.run_in_executor(None, fn)
        except Exception as exc:  # noqa: BLE001
            logger.error("gaze_track_error", error=str(exc), frame_id=request.frame_id)
            return self._fallback(request)

        return GazeResult(
            screen_point=ScreenPoint(x=face_result.gaze.x, y=face_result.gaze.y),
            gaze_vector=GazeVector(
                yaw=face_result.yaw,
                pitch=face_result.pitch,
                roll=face_result.roll,
            ),
            on_screen=face_result.face_detected,
            tracking_confidence=face_result.tracking_confidence,
            left_eye_openness=face_result.eye_open.left,
            right_eye_openness=face_result.eye_open.right,
            frame_id=request.frame_id,
            session_id=request.session_id,
            processed_at=__import__("datetime").datetime.now(
                __import__("datetime").timezone.utc
            ),
            mock=False,
        )

    # ------------------------------------------------------------------
    # Fallback (no image provided or decode failure)
    # ------------------------------------------------------------------

    @staticmethod
    def _fallback(request: GazeRequest) -> GazeResult:
        import datetime

        return GazeResult(
            screen_point=ScreenPoint(x=0.5, y=0.5),
            gaze_vector=GazeVector(yaw=0.0, pitch=0.0, roll=0.0),
            on_screen=False,
            tracking_confidence=0.0,
            left_eye_openness=0.0,
            right_eye_openness=0.0,
            frame_id=request.frame_id,
            session_id=request.session_id,
            processed_at=datetime.datetime.now(datetime.timezone.utc),
            mock=False,
        )
