"""Gaze service."""

from app.gaze.interfaces import GazeTracker
from app.models.gaze import GazeRequest, GazeResult


class GazeService:
    def __init__(self, tracker: GazeTracker) -> None:
        self._tracker = tracker

    async def track(self, request: GazeRequest) -> GazeResult:
        return await self._tracker.track(request)
