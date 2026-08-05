"""Attention Score interface."""

from typing import Protocol, runtime_checkable

from app.models.attention import AttentionRequest, AttentionResult


@runtime_checkable
class AttentionScorer(Protocol):
    """Compute attention / focus score from multimodal signals."""

    async def score(self, request: AttentionRequest) -> AttentionResult:
        """
        Fuse emotion, gaze, head-pose (and optional audio) into 0–100 score.

        Real implementation will use a calibrated fusion model / heuristics.
        """
        ...
