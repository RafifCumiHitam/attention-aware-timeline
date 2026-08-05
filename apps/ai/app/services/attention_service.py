"""Attention service."""

from app.attention.interfaces import AttentionScorer
from app.models.attention import AttentionRequest, AttentionResult


class AttentionService:
    def __init__(self, scorer: AttentionScorer) -> None:
        self._scorer = scorer

    async def score(self, request: AttentionRequest) -> AttentionResult:
        return await self._scorer.score(request)
