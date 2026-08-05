"""API v1 router aggregation."""

from fastapi import APIRouter

from app.presentation.api.v1.health.router import router as health_router
from app.presentation.api.v1.auth.router import router as auth_router
from app.presentation.api.v1.users.router import router as users_router
from app.presentation.api.v1.videos.router import router as videos_router
from app.presentation.api.v1.sessions.router import router as sessions_router
from app.presentation.api.v1.events.router import router as events_router
from app.presentation.api.v1.analytics.router import router as analytics_router
from app.presentation.api.v1.websocket.router import router as ws_router

api_v1_router = APIRouter()

api_v1_router.include_router(health_router, prefix="/health", tags=["Health"])
api_v1_router.include_router(auth_router, prefix="/auth", tags=["Authentication"])
api_v1_router.include_router(users_router, prefix="/users", tags=["Users"])
api_v1_router.include_router(videos_router, prefix="/videos", tags=["Videos"])
api_v1_router.include_router(sessions_router, prefix="/sessions", tags=["Sessions"])
api_v1_router.include_router(events_router, prefix="/events", tags=["Interaction Events"])
api_v1_router.include_router(analytics_router, prefix="/analytics", tags=["Analytics"])
api_v1_router.include_router(ws_router, prefix="/ws", tags=["WebSocket"])
