"""Import all models so Alembic and Base.metadata discover them."""

from app.infrastructure.database.models.user import User
from app.infrastructure.database.models.video import Video
from app.infrastructure.database.models.session import LearningSession, SessionStatus
from app.infrastructure.database.models.event import InteractionEvent, EventType
from app.infrastructure.database.models.transcript import VideoTranscript
from app.infrastructure.database.models.prediction import AIPrediction, PredictionType
from app.infrastructure.database.models.analytics import LearningAnalytics, PeriodType
from app.infrastructure.database.models.difficulty import DifficultyTimeline, TimelineOutcome
from app.infrastructure.database.models.cache import SummaryCache, ResourceType

__all__ = [
    "User",
    "Video",
    "LearningSession",
    "SessionStatus",
    "InteractionEvent",
    "EventType",
    "VideoTranscript",
    "AIPrediction",
    "PredictionType",
    "LearningAnalytics",
    "PeriodType",
    "DifficultyTimeline",
    "TimelineOutcome",
    "SummaryCache",
    "ResourceType",
]
