"""Mock EmotionDetector — deterministic placeholder responses."""

import random
from datetime import datetime, timezone

from app.models.emotion import EmotionLabel, EmotionRequest, EmotionResult, EmotionScores


class MockEmotionDetector:
    """Returns realistic mock emotion distributions. No model loaded."""

    async def detect(self, request: EmotionRequest) -> EmotionResult:
        # Stable-ish seed from frame id if provided
        seed = hash(request.frame_id or request.session_id or "default") % (2**32)
        rng = random.Random(seed)

        raw = {
            EmotionLabel.NEUTRAL: rng.uniform(0.25, 0.55),
            EmotionLabel.HAPPY: rng.uniform(0.05, 0.35),
            EmotionLabel.SAD: rng.uniform(0.02, 0.15),
            EmotionLabel.SURPRISED: rng.uniform(0.02, 0.12),
            EmotionLabel.ANGRY: rng.uniform(0.01, 0.08),
            EmotionLabel.FEARFUL: rng.uniform(0.01, 0.06),
            EmotionLabel.DISGUSTED: rng.uniform(0.0, 0.04),
        }
        total = sum(raw.values())
        normalized = {k: round(v / total, 4) for k, v in raw.items()}
        dominant = max(normalized, key=normalized.get)  # type: ignore[arg-type]

        return EmotionResult(
            dominant=dominant,
            confidence=normalized[dominant],
            scores=EmotionScores(**{k.value: v for k, v in normalized.items()}),
            face_detected=True,
            frame_id=request.frame_id,
            session_id=request.session_id,
            processed_at=datetime.now(timezone.utc),
            mock=True,
        )
