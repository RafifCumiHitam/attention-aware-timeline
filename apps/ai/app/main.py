"""AI microservice — FastAPI entry point.

Inference is mocked. Swap Mock* implementations in `app.dependencies`
when real Emotion / Gaze / Attention / Summary models are ready.
"""

from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_v1_router
from app.core.config import get_settings
from app.core.logging import get_logger, setup_logging

setup_logging()
logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    settings = get_settings()
    logger.info(
        "ai_startup",
        environment=settings.environment,
        mock_inference=settings.mock_inference,
        device=settings.device,
    )

    # Load face analyser (no-op in mock mode)
    if not settings.mock_inference:
        from app.dependencies import get_face_analyzer  # noqa: PLC0415

        analyzer = get_face_analyzer()
        if analyzer is not None:
            logger.info("face_analyzer_loaded", model_path=settings.model_path)
        else:
            logger.warning(
                "face_analyzer_unavailable",
                reason="model file missing or mediapipe not installed",
            )

    yield
    logger.info("ai_shutdown")


def create_application() -> FastAPI:
    settings = get_settings()

    app = FastAPI(
        title="Attention-Aware Timeline — AI Service",
        description=(
            "Deep Learning microservice for adaptive learning.\n\n"
            "## Capabilities (interfaces ready, mock inference)\n"
            "- **Emotion Detection** — `POST /api/v1/emotion/detect`\n"
            "- **Eye Tracking** — `POST /api/v1/gaze/track`\n"
            "- **Attention Score** — `POST /api/v1/attention/score`\n"
            "- **Summary Generator** — `POST /api/v1/summary/generate`\n\n"
            "All responses include `mock: true` until real models are wired via DI."
        ),
        version="0.1.0",
        docs_url="/docs",
        redoc_url="/redoc",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(api_v1_router, prefix=settings.api_v1_prefix)

    return app


app = create_application()
