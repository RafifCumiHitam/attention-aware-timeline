"""WebSocket Connection Manager for active user sessions."""

import asyncio
from typing import Any
from fastapi import WebSocket
from app.core.logging import get_logger

logger = get_logger(__name__)


class ConnectionManager:
    """Manages active WebSocket connections per session and user."""

    def __init__(self) -> None:
        # Maps session_id -> set of active WebSockets
        self._session_connections: dict[str, set[WebSocket]] = {}
        # Maps user_id -> set of active WebSockets
        self._user_connections: dict[str, set[WebSocket]] = {}
        self._lock = asyncio.Lock()

    async def connect(self, websocket: WebSocket, session_id: str, user_id: str) -> None:
        """Accept connection and track by session and user ID."""
        await websocket.accept()
        async with self._lock:
            if session_id not in self._session_connections:
                self._session_connections[session_id] = set()
            self._session_connections[session_id].add(websocket)

            if user_id not in self._user_connections:
                self._user_connections[user_id] = set()
            self._user_connections[user_id].add(websocket)

        logger.info(
            "websocket_connected",
            session_id=session_id,
            user_id=user_id,
            active_sessions=len(self._session_connections),
        )

    async def disconnect(self, websocket: WebSocket, session_id: str, user_id: str) -> None:
        """Remove connection from active registries."""
        async with self._lock:
            if session_id in self._session_connections:
                self._session_connections[session_id].discard(websocket)
                if not self._session_connections[session_id]:
                    del self._session_connections[session_id]

            if user_id in self._user_connections:
                self._user_connections[user_id].discard(websocket)
                if not self._user_connections[user_id]:
                    del self._user_connections[user_id]

        logger.info(
            "websocket_disconnected",
            session_id=session_id,
            user_id=user_id,
        )

    async def send_personal_json(self, websocket: WebSocket, data: dict[str, Any]) -> None:
        """Send JSON message directly to a specific socket."""
        try:
            await websocket.send_json(data)
        except Exception as exc:
            logger.warning("websocket_send_failed", error=str(exc))

    async def broadcast_to_session(
        self, session_id: str, data: dict[str, Any], exclude: WebSocket | None = None
    ) -> None:
        """Broadcast JSON message to all clients connected to a specific session."""
        sockets = self._session_connections.get(session_id, set())
        for ws in list(sockets):
            if ws != exclude:
                try:
                    await ws.send_json(data)
                except Exception as exc:
                    logger.warning("websocket_broadcast_failed", session_id=session_id, error=str(exc))

    async def broadcast_to_user(self, user_id: str, data: dict[str, Any]) -> None:
        """Broadcast JSON message to all sockets for a given user."""
        sockets = self._user_connections.get(user_id, set())
        for ws in list(sockets):
            try:
                await ws.send_json(data)
            except Exception as exc:
                logger.warning("websocket_user_broadcast_failed", user_id=user_id, error=str(exc))

    def get_active_sessions_count(self) -> int:
        """Get number of active sessions currently connected."""
        return len(self._session_connections)


# Global singleton instance for connection manager
manager = ConnectionManager()
