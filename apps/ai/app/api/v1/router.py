"""API v1 aggregator."""

from fastapi import APIRouter

from app.api.v1 import attention, emotion, gaze, health, summary

api_v1_router = APIRouter()
api_v1_router.include_router(health.router)
api_v1_router.include_router(emotion.router)
api_v1_router.include_router(gaze.router)
api_v1_router.include_router(attention.router)
api_v1_router.include_router(summary.router)
