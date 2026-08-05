"""Face analysis HTTP endpoint.

POST /api/v1/face/analyze
    Accepts a base64-encoded frame and returns the full face-analysis result
    in the exact JSON shape specified in the project contract:

        {
            "gaze":      {"x": float, "y": float},
            "eye_open":  {"left": float, "right": float},
            "yaw":       float,
            "pitch":     float,
            "roll":      float,
            "timestamp": float,
            ...metadata fields...
        }
"""

from __future__ import annotations

import asyncio
import logging
from functools import partial

from fastapi import APIRouter, Depends, HTTPException, status

from app.face.schemas import FaceAnalysisRequest, FaceAnalysisResult
from app.face.landmarker import MediaPipeFaceAnalyzer
from app.dependencies import get_face_analyzer

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/face", tags=["Face Analysis"])


@router.post(
    "/analyze",
    response_model=FaceAnalysisResult,
    summary="Analyse a single video frame",
    description=(
        "Run face detection, eye tracking, head-pose estimation, and blink detection "
        "on a single JPEG/PNG frame supplied as a base64-encoded string. "
        "Returns gaze point, eye openness, yaw/pitch/roll, and a Unix timestamp."
    ),
)
async def analyze_frame(
    body: FaceAnalysisRequest,
    analyzer: MediaPipeFaceAnalyzer | None = Depends(get_face_analyzer),
) -> FaceAnalysisResult:
    if analyzer is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Face analyser is not available (model not loaded). "
                   "Set MOCK_INFERENCE=false and ensure the model file exists.",
        )

    if not body.image_base64 and not body.image_url:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Provide either image_base64 or image_url.",
        )

    loop = asyncio.get_running_loop()
    fn = partial(
        analyzer.analyze_frame,
        image_base64=body.image_base64,
        frame_id=body.frame_id,
        session_id=body.session_id,
        video_timestamp=body.video_timestamp,
    )

    try:
        result: FaceAnalysisResult = await loop.run_in_executor(None, fn)
    except Exception as exc:
        logger.error("face_analyze_error", error=str(exc))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Inference failed: {exc}",
        ) from exc

    return result


@router.get(
    "/health",
    summary="Face analyser health",
    tags=["Face Analysis"],
)
async def face_health(
    analyzer: MediaPipeFaceAnalyzer | None = Depends(get_face_analyzer),
) -> dict:
    return {
        "face_analyzer_ready": analyzer is not None,
        "mode": "mediapipe" if analyzer is not None else "unavailable",
    }
