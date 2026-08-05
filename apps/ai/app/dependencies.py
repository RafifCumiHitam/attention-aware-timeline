"""FastAPI dependency injection wiring.

Swap Mock* classes for real model-backed implementations without changing routers.
"""

import logging
from functools import lru_cache
from pathlib import Path

from app.attention.mock import MockAttentionScorer
from app.core.config import get_settings
from app.emotion.mock import MockEmotionDetector
from app.gaze.mock import MockGazeTracker
from app.services.attention_service import AttentionService
from app.services.emotion_service import EmotionService
from app.services.gaze_service import GazeService
from app.services.summary_service import SummaryService
from app.summary.mock import MockSummaryGenerator

logger = logging.getLogger(__name__)


@lru_cache
def get_emotion_detector() -> MockEmotionDetector:
    return MockEmotionDetector()


@lru_cache
def get_gaze_tracker() -> MockGazeTracker:
    return MockGazeTracker()


@lru_cache
def get_attention_scorer() -> MockAttentionScorer:
    return MockAttentionScorer()


@lru_cache
def get_summary_generator() -> MockSummaryGenerator:
    return MockSummaryGenerator()


def get_emotion_service() -> EmotionService:
    return EmotionService(detector=get_emotion_detector())


def get_gaze_service() -> GazeService:
    return GazeService(tracker=get_gaze_tracker())


def get_attention_service() -> AttentionService:
    return AttentionService(scorer=get_attention_scorer())


def get_summary_service() -> SummaryService:
    return SummaryService(generator=get_summary_generator())


def get_face_analyzer():
    """Return a ``MediaPipeFaceAnalyzer`` when MediaPipe is available.

    Returns ``None`` when *mock_inference* is True or the model file is missing,
    so callers can degrade gracefully without crashing on import.
    """
    settings = get_settings()
    if settings.mock_inference:
        return None

    # Lazy import — only pulled in when mock_inference is False
    try:
        from app.face.landmarker import MediaPipeFaceAnalyzer  # noqa: PLC0415
    except ImportError:
        logger.warning("mediapipe_not_installed")
        return None

    model_file = Path(settings.model_path) / "face_landmarker.task"
    if not model_file.exists():
        logger.warning("face_model_not_found", path=str(model_file))
        return None

    return _get_face_analyzer_cached(str(model_file), settings.max_faces, settings.confidence_threshold)


@lru_cache
def _get_face_analyzer_cached(
    model_path: str,
    max_faces: int,
    confidence_threshold: float,
):
    """Singleton ``MediaPipeFaceAnalyzer`` — created once per process."""
    from app.face.landmarker import MediaPipeFaceAnalyzer  # noqa: PLC0415

    return MediaPipeFaceAnalyzer(
        model_path=model_path,
        max_faces=max_faces,
        confidence_threshold=confidence_threshold,
    )
