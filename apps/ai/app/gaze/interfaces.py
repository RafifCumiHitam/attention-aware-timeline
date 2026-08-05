"""Eye Tracking / Gaze Estimation interface."""

from typing import Protocol, runtime_checkable

from app.models.gaze import GazeRequest, GazeResult


@runtime_checkable
class GazeTracker(Protocol):
    """Estimate gaze direction and on-screen focus point."""

    async def track(self, request: GazeRequest) -> GazeResult:
        """
        Return gaze vector, screen coordinates, and tracking quality.

        Real implementation will use MediaPipe Iris / custom gaze model.
        """
        ...
