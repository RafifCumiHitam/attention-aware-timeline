"""Mock AttentionScorer."""

import random
from datetime import datetime, timezone

from app.models.attention import AttentionLevel, AttentionRequest, AttentionResult


class MockAttentionScorer:
    async def score(self, request: AttentionRequest) -> AttentionResult:
        seed = hash(
            f"{request.session_id}:{request.video_timestamp}:{request.frame_id}"
        ) % (2**32)
        rng = random.Random(seed)

        # Optional signals bias the mock score
        base = rng.uniform(55, 92)
        if request.gaze_on_screen is False:
            base -= rng.uniform(15, 30)
        if request.emotion_confidence is not None:
            base = base * 0.7 + request.emotion_confidence * 100 * 0.3

        score = round(max(0.0, min(100.0, base)), 2)

        if score >= 80:
            level = AttentionLevel.HIGH
        elif score >= 55:
            level = AttentionLevel.MEDIUM
        elif score >= 30:
            level = AttentionLevel.LOW
        else:
            level = AttentionLevel.CRITICAL

        return AttentionResult(
            score=score,
            level=level,
            components={
                "gaze": round(rng.uniform(0.5, 1.0), 3),
                "head_pose": round(rng.uniform(0.5, 1.0), 3),
                "emotion_stability": round(rng.uniform(0.4, 1.0), 3),
                "blink_rate_ok": round(rng.uniform(0.6, 1.0), 3),
            },
            video_timestamp=request.video_timestamp,
            frame_id=request.frame_id,
            session_id=request.session_id,
            processed_at=datetime.now(timezone.utc),
            mock=True,
        )
