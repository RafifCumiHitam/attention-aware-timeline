"""Health check endpoints."""

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.database.base import get_db

router = APIRouter()


@router.get("", summary="Liveness probe")
@router.get("/", summary="Liveness probe", include_in_schema=False)
async def health_check() -> dict:
    return {"status": "ok", "service": "api"}


@router.get("/ready", summary="Readiness probe")
async def readiness_check(db: AsyncSession = Depends(get_db)) -> dict:
    try:
        await db.execute(text("SELECT 1"))
        db_ok = True
    except Exception:
        db_ok = False
    status = "ready" if db_ok else "not_ready"
    return {"status": status, "service": "api", "database": db_ok}
