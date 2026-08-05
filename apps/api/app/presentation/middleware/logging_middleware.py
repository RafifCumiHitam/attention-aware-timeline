"""Request logging middleware (ASGI compatible with WebSockets)."""

import time
import uuid
from starlette.types import ASGIApp, Receive, Scope, Send

from app.core.logging import get_logger

logger = get_logger(__name__)


class RequestLoggingMiddleware:
    """Pure ASGI logging middleware that supports HTTP and bypasses WebSocket connections safely."""

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        request_id = str(uuid.uuid4())
        start = time.perf_counter()

        async def send_wrapper(message: dict) -> None:
            if message["type"] == "http.response.start":
                duration_ms = (time.perf_counter() - start) * 1000
                logger.info(
                    "request",
                    method=scope.get("method"),
                    path=scope.get("path"),
                    status=message.get("status"),
                    duration_ms=round(duration_ms, 2),
                    request_id=request_id,
                )
            await send(message)

        await self.app(scope, receive, send_wrapper)
