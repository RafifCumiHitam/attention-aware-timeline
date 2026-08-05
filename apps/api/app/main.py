"""FastAPI application entry point."""

from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.utils import get_openapi

from app.core.config import get_settings
from app.core.logging import get_logger, setup_logging
from app.presentation.api.v1.router import api_v1_router
from app.presentation.middleware.exception_handlers import register_exception_handlers
from app.presentation.middleware.logging_middleware import RequestLoggingMiddleware

setup_logging()
logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    settings = get_settings()
    logger.info("startup", environment=settings.environment, project=settings.project_name)
    yield
    logger.info("shutdown")


def custom_openapi(app: FastAPI):
    if app.openapi_schema:
        return app.openapi_schema
    schema = get_openapi(
        title=app.title,
        version=app.version,
        description=app.description,
        routes=app.routes,
    )
    schema["components"] = schema.get("components", {})
    schema["components"]["securitySchemes"] = {
        "BearerAuth": {
            "type": "http",
            "scheme": "bearer",
            "bearerFormat": "JWT",
            "description": "Enter JWT access token",
        }
    }
    schema["security"] = [{"BearerAuth": []}]
    app.openapi_schema = schema
    return app.openapi_schema


def create_application() -> FastAPI:
    settings = get_settings()

    app = FastAPI(
        title="Attention-Aware Timeline API",
        description=(
            "Production backend for the Attention-Aware Adaptive Learning Platform.\n\n"
            "## Features\n"
            "- **Authentication** — JWT register / login / refresh\n"
            "- **Users** — profile management\n"
            "- **Videos** — learning content catalog\n"
            "- **Sessions** — learning session lifecycle\n"
            "- **Interaction Events** — play/pause/attention samples\n"
            "- **Analytics** — overview, trends, top videos\n\n"
            "Use the **Authorize** button with a Bearer access token."
        ),
        version="0.1.0",
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url="/openapi.json",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.add_middleware(RequestLoggingMiddleware)

    register_exception_handlers(app)

    app.include_router(api_v1_router, prefix=settings.api_v1_prefix)

    app.openapi = lambda: custom_openapi(app)  # type: ignore[method-assign]

    return app


app = create_application()
