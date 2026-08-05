"""Eye Tracking / Gaze endpoints."""

from fastapi import APIRouter, Depends

from app.dependencies import get_gaze_service
from app.models.gaze import GazeRequest, GazeResult
from app.services.gaze_service import GazeService

router = APIRouter(prefix="/gaze", tags=["Eye Tracking"])


@router.post("/track", response_model=GazeResult, summary="Estimate gaze direction")
async def track_gaze(
    body: GazeRequest,
    service: GazeService = Depends(get_gaze_service),
) -> GazeResult:
    """
    Estimate gaze vector and normalized on-screen focus point.

    **Mock mode:** no MediaPipe / iris model is invoked.
    """
    return await service.track(body)
