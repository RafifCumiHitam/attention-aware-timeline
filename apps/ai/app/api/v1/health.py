"""Health & readiness probes."""

from fastapi import APIRouter

from app.core.config import get_settings

router = APIRouter(tags=["Health"])


@router.get("/health")
async def health() -> dict:
    settings = get_settings()
    return {
        "status": "ok",
        "service": settings.project_name,
        "environment": settings.environment,
        "mock_inference": settings.mock_inference,
    }


@router.get("/ready")
async def ready() -> dict:
    """Readiness — later check model weights loaded."""
    return {"ready": True, "models_loaded": False, "mode": "mock"}
