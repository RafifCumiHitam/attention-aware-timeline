"""Mock SummaryGenerator."""

from datetime import datetime, timezone

from app.models.summary import (
    SummaryHighlight,
    SummaryRequest,
    SummaryResult,
    SummaryStats,
)


class MockSummaryGenerator:
    async def generate(self, request: SummaryRequest) -> SummaryResult:
        duration = request.duration_seconds or 900
        avg_att = request.average_attention or 78.5
        completion = request.completion_percent or 85.0

        narrative = (
            f"Session lasting {duration // 60}m {duration % 60}s with average attention "
            f"{avg_att:.0f}% and {completion:.0f}% video completion. "
            "Focus was strongest in the opening segment; attention dipped around mid-lesson "
            "where seek activity increased. Recommend reviewing the mid-section timestamps."
        )

        return SummaryResult(
            title=request.title or "Learning session summary",
            narrative=narrative,
            stats=SummaryStats(
                duration_seconds=duration,
                average_attention=avg_att,
                completion_percent=completion,
                pause_count=request.pause_count or 12,
                seek_count=request.seek_count or 7,
                dominant_emotion=request.dominant_emotion or "neutral",
            ),
            highlights=[
                SummaryHighlight(
                    timestamp=120,
                    kind="attention_peak",
                    message="High focus while core concept was introduced",
                ),
                SummaryHighlight(
                    timestamp=420,
                    kind="attention_dip",
                    message="Attention dropped; multiple seeks detected",
                ),
                SummaryHighlight(
                    timestamp=660,
                    kind="recovery",
                    message="Focus recovered after paced review segment",
                ),
            ],
            recommendations=[
                "Revisit the segment around 7:00 with slower playback (0.75x–1.0x).",
                "Take a short break before continuing to the next module.",
                "Enable attention-aware difficulty when available for adaptive pacing.",
            ],
            session_id=request.session_id,
            video_id=request.video_id,
            processed_at=datetime.now(timezone.utc),
            mock=True,
        )
