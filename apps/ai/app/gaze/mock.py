"""Mock GazeTracker."""

import random
from datetime import datetime, timezone

from app.models.gaze import GazeRequest, GazeResult, GazeVector, ScreenPoint


class MockGazeTracker:
    async def track(self, request: GazeRequest) -> GazeResult:
        seed = hash(request.frame_id or request.session_id or "gaze") % (2**32)
        rng = random.Random(seed)

        x = round(rng.uniform(0.15, 0.85), 4)
        y = round(rng.uniform(0.15, 0.85), 4)
        # Gaze directed roughly toward center of screen content
        yaw = round((x - 0.5) * 40, 2)
        pitch = round((0.5 - y) * 30, 2)

        return GazeResult(
            screen_point=ScreenPoint(x=x, y=y),
            gaze_vector=GazeVector(yaw=yaw, pitch=pitch, roll=round(rng.uniform(-5, 5), 2)),
            on_screen=0.1 < x < 0.9 and 0.1 < y < 0.9,
            tracking_confidence=round(rng.uniform(0.75, 0.98), 4),
            left_eye_openness=round(rng.uniform(0.7, 1.0), 3),
            right_eye_openness=round(rng.uniform(0.7, 1.0), 3),
            frame_id=request.frame_id,
            session_id=request.session_id,
            processed_at=datetime.now(timezone.utc),
            mock=True,
        )
