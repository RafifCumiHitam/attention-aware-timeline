"""FastAPI dependency injection wiring.

Swap Mock* classes for real model-backed implementations without changing routers.
"""

from functools import lru_cache

from app.attention.mock import MockAttentionScorer
from app.emotion.mock import MockEmotionDetector
from app.gaze.mock import MockGazeTracker
from app.services.attention_service import AttentionService
from app.services.emotion_service import EmotionService
from app.services.gaze_service import GazeService
from app.services.summary_service import SummaryService
from app.summary.mock import MockSummaryGenerator


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
