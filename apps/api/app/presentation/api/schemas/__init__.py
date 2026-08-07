from app.presentation.api.schemas.common import (
    ErrorResponse,
    MessageResponse,
    PaginatedResponse,
    PaginationQuery,
)
from app.presentation.api.schemas.auth import (
    AuthUserResponse,
    LoginRequest,
    RefreshRequest,
    RegisterRequest,
    TokenResponse,
)
from app.presentation.api.schemas.user import UserCreate, UserPublic, UserResponse, UserUpdate
from app.presentation.api.schemas.video import VideoCreate, VideoListItem, VideoResponse, VideoUpdate
from app.presentation.api.schemas.session import (
    SessionCreate,
    SessionResponse,
    SessionUpdate,
)
from app.presentation.api.schemas.event import EventBatchCreate, EventCreate, EventResponse
from app.presentation.api.schemas.analytics import AnalyticsOverviewResponse, OverviewStats

__all__ = [
    "ErrorResponse",
    "MessageResponse",
    "PaginatedResponse",
    "PaginationQuery",
    "AuthUserResponse",
    "LoginRequest",
    "RefreshRequest",
    "RegisterRequest",
    "TokenResponse",
    "UserCreate",
    "UserPublic",
    "UserResponse",
    "UserUpdate",
    "VideoCreate",
    "VideoListItem",
    "VideoResponse",
    "VideoUpdate",
    "SessionCreate",
    "SessionResponse",
    "SessionUpdate",
    "EventBatchCreate",
    "EventCreate",
    "EventResponse",
    "AnalyticsOverviewResponse",
    "OverviewStats",
]
